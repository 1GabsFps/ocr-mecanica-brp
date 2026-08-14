import { VehicleData } from '../types';
import { formatPlate, formatOwner, formatModel } from './ocrService';
import { compressImageForAi } from '../utils/imagePreprocessing';
import { sendDiscordSystemAlert } from './discordService';

/**
 * Modelos com prioridade absoluta:
 * 1. gemini-3.5-flash-lite (Ultra-rápido, alta acurácia visual e suporte nativo a responseSchema)
 * 2. gemini-3.1-flash-lite (Fallback de contingência)
 */
const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

let keyRotationIndex = 0;

/**
 * Esquema JSON Estruturado Nativo (Gemini Constrained Decoding)
 */
const OCR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    placa: {
      type: 'STRING',
      description: 'Placa presente na coluna Placa da tabela (ex: CST 2535, TK 7809, BRA 2E19)',
    },
    proprietario: {
      type: 'STRING',
      description: 'Nome completo do cliente na coluna Proprietário (ex: Carlos Miguel, Lucca Changretta)',
    },
    modelo: {
      type: 'STRING',
      description: 'Nome do veículo na coluna Carro em CAIXA ALTA preservando hífens (ex: F-150 RAPTOR, S60, SCANIA R780, R780. 4X2)',
    },
    servico: {
      type: 'STRING',
      description: 'Serviço padrão realizado (sempre: Troca de óleo e filtro)',
    },
  },
  required: ['placa', 'proprietario', 'modelo', 'servico'],
};

/**
 * Prompt com In-Context Learning (Few-Shot) e Auto-Verificação (Double Check)
 */
const SYSTEM_PROMPT = `Você é um extrator de altíssima precisão especialista em HUDs de oficinas mecânicas do GTA RP / FiveM.

INSTRUÇÃO PRINCIPAL:
1. Localize a TABELA HORIZONTAL DA OFICINA no CENTRO da tela (cabeçalhos: Placa | Proprietário | Carro | Cor | Modificações | Fipe | IPVA | Multas).
2. Extraia com precisão cirúrgica os dados da linha de dados localizada diretamente abaixo desses cabeçalhos.

REGRAS DE LEITURA E DESAMBIGUAÇÃO (DOUBLE CHECK):
- DOUBLE CHECK DE CARACTERES: Diferencie com rigor números de letras semelhantes (Ex: 'S60' e NUNCA 'SEO' ou 'S6O'; '0' vs 'O'; '1' vs 'I').
- PRESERVAÇÃO DE HÍFENS: Mantenha sempre hífens originais de fábrica nos modelos (Ex: 'F-150 RAPTOR', 'F-250', 'GT-R', 'CX-5', 'AMG-GT', 'CR-V').
- NOMES PRÓPRIOS: Transcreva nomes e sobrenomes compostos com precisão (Ex: 'Carlos Miguel' e NUNCA 'Conos Míguel'; 'Lucca Changretta'; 'Don Escobar'; 'Luiz Felipe').
- PONTOS E TRAÇÕES: Mantenha pontos e trações de caminhões/utilitários (Ex: 'R780. 4X2', 'FH16 780').

EXEMPLOS REAIS DE EXTRAÇÃO (IN-CONTEXT LEARNING):
- HUD Volvo: Coluna Carro: "S60" | Coluna Proprietário: "Carlos Miguel" | Coluna Placa: "CST 2535" -> {"placa": "CST 2535", "proprietario": "Carlos Miguel", "modelo": "S60", "servico": "Troca de óleo e filtro"}
- HUD Picape Ford: Coluna Carro: "F-150 RAPTOR" | Coluna Proprietário: "Don Escobar" | Coluna Placa: "BRA 2E19" -> {"placa": "BRA 2E19", "proprietario": "Don Escobar", "modelo": "F-150 RAPTOR", "servico": "Troca de óleo e filtro"}
- HUD Caminhão Scania: Coluna Carro: "R780. 4X2" | Coluna Proprietário: "Lucca Changretta" | Coluna Placa: "TK 7809" -> {"placa": "TK 7809", "proprietario": "Lucca Changretta", "modelo": "R780. 4X2", "servico": "Troca de óleo e filtro"}
- HUD Clássico: Coluna Carro: "MAREA WEEKEND TURBO" | Coluna Proprietário: "Luiz Felipe" | Coluna Placa: "EBI 7783" -> {"placa": "EBI 7783", "proprietario": "Luiz Felipe", "modelo": "MAREA WEEKEND TURBO", "servico": "Troca de óleo e filtro"}

IGNORE TOTALMENTE:
- Textos de cantos inferiores, resoluções de tela e marcas d'água.
- Peças de motor e barra lateral esquerda.
- IDs de jogador, relógio, data e dinheiro no topo da tela.`;

/**
 * Retorna as chaves disponíveis, suportando pool de chaves separadas por vírgula no .env
 */
export function parseApiKeys(keysString: string): string[] {
  if (!keysString) return [];
  return keysString
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Executa uma requisição individual direta para a API Gemini
 */
async function executeGeminiRequest(
  key: string,
  model: string,
  compressed: { mimeType: string; base64Data: string },
  signal: AbortSignal,
  keySlotName?: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inlineData: {
                mimeType: compressed.mimeType,
                data: compressed.base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: OCR_RESPONSE_SCHEMA,
        temperature: 0.0,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Erro ${response.status}: ${response.statusText}`;

    // Alerta de B.O. imediato no Discord se bater Cota 429 ou Chave Inválida
    if (response.status === 429) {
      sendDiscordSystemAlert({
        errorType: 'Cota de Requisições Atingida (Rate Limit 429)',
        keySlot: keySlotName || 'Chave do Pool',
        message: 'A cota por minuto/dia desta chave foi atingida. Alternando para a reserva.',
        code: 429,
      });
    } else if (response.status === 400 || response.status === 403) {
      sendDiscordSystemAlert({
        errorType: `Erro de Autenticação (${response.status})`,
        keySlot: keySlotName || 'Chave do Pool',
        message,
        code: response.status,
      });
    }

    throw new Error(message);
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return rawContent;
}

/**
 * Extração de alta velocidade com Hedged Racing (Corrida de Chaves com Aceleração a 2.5s)
 * e Auditoria Técnica de Slots de Chave.
 */
export async function extractWithGemini(
  imageDataUrl: string,
  apiKeyInput: string,
  onModelAttempt?: (modelName: string, modelDisplay: string) => void
): Promise<VehicleData> {
  const keys = parseApiKeys(apiKeyInput);
  if (keys.length === 0) {
    throw new Error('Chave de API não configurada.');
  }

  // 1. Redimensionar e pré-processar em Ultra-HD (1600px, 95% de qualidade em JPEG 100% estável)
  const compressed = await compressImageForAi(imageDataUrl, 1600, 0.95, 'jpeg');

  onModelAttempt?.(PRIMARY_MODEL, 'Gemini 3.5 Flash Lite');

  // Se houver apenas 1 chave, executa chamada direta simples
  if (keys.length === 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const raw = await executeGeminiRequest(keys[0], PRIMARY_MODEL, compressed, controller.signal, 'Chave Única');
      clearTimeout(timer);
      return parseAndFormatResponse(raw, 'gemini-3.5-flash-lite', 'Chave Única (Personalizada)', false);
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  // CORRIDA INTELIGENTE DE CHAVES (Hedged Racing Calibrado para Latência de 2.5s):
  // Dispara a Chave 1. Se não responder em 2500ms (dando folga para conexões distantes), dispara a Chave 2 em paralelo.
  // A mais rápida entrega o resultado na hora e cancela a chave lenta!
  const idx1 = keyRotationIndex % keys.length;
  const idx2 = (keyRotationIndex + 1) % keys.length;
  const key1 = keys[idx1];
  const key2 = keys[idx2];
  const slotName1 = `Chave #${idx1 + 1} (Principal)`;
  const slotName2 = `Chave #${idx2 + 1} (Reserva/Hedge)`;

  const ctrl1 = new AbortController();
  const ctrl2 = new AbortController();

  let globalTimeout: ReturnType<typeof setTimeout>;

  try {
    let runP2Now: (() => void) | null = null;

    const p1 = executeGeminiRequest(key1, PRIMARY_MODEL, compressed, ctrl1.signal, slotName1).then((raw) => ({
      raw,
      slot: slotName1,
      hedged: false,
    }));

    const hedgedP2 = new Promise<{ raw: string; slot: string; hedged: boolean }>((resolve, reject) => {
      let isExecuted = false;

      const runP2 = async () => {
        if (isExecuted) return;
        isExecuted = true;
        try {
          const raw2 = await executeGeminiRequest(key2, PRIMARY_MODEL, compressed, ctrl2.signal, slotName2);
          resolve({ raw: raw2, slot: slotName2, hedged: true });
        } catch (e) {
          reject(e);
        }
      };

      const hedgeTimer = setTimeout(() => {
        runP2();
      }, 2500);

      runP2Now = () => {
        clearTimeout(hedgeTimer);
        runP2();
      };

      // Se p1 resolver antes dos 2500ms, cancela o hedgeTimer
      p1.then(() => clearTimeout(hedgeTimer)).catch(() => {
        // Se p1 falhar com erro antes dos 2500ms, aciona p2 IMEDIATAMENTE!
        clearTimeout(hedgeTimer);
        runP2();
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      globalTimeout = setTimeout(() => {
        ctrl1.abort();
        ctrl2.abort();
        reject(new Error('Tempo limite de requisição excedido'));
      }, 9000);
    });

    // Se p1 falhar, não derruba o Promise.race: cede a vez para p2 responder!
    const safeP1 = p1
      .then((r) => {
        ctrl2.abort();
        keyRotationIndex = (keyRotationIndex + 1) % keys.length;
        return r;
      })
      .catch(() => {
        if (runP2Now) runP2Now();
        // Retorna promessa pendente para o race aguardar p2
        return new Promise<{ raw: string; slot: string; hedged: boolean }>(() => {});
      });

    const safeP2 = hedgedP2.then((r) => {
      ctrl1.abort();
      keyRotationIndex = (keyRotationIndex + 2) % keys.length;
      return r;
    });

    const winner = await Promise.race([safeP1, safeP2, timeoutPromise]);

    clearTimeout(globalTimeout!);
    return parseAndFormatResponse(winner.raw, 'gemini-3.5-flash-lite', winner.slot, winner.hedged);
  } catch (err: any) {
    clearTimeout(globalTimeout!);
    ctrl1.abort();
    ctrl2.abort();
    console.warn('Falha na corrida principal 3.5, tentando fallback secundário:', err);

    // Fallback de emergência caso haja indisponibilidade global
    for (const model of FALLBACK_MODELS) {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const slot = `Chave #${i + 1} (Fallback)`;
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 4000);
          const raw = await executeGeminiRequest(k, model, compressed, c.signal, slot);
          clearTimeout(t);
          return parseAndFormatResponse(raw, model, slot, false);
        } catch (_) {}
      }
    }

    // Se falhou totalmente, dispara Alerta de B.O. Crítico no Discord
    sendDiscordSystemAlert({
      errorType: 'Falha Total na Conexão com a IA (Fallback Local Necessário)',
      keySlot: 'Todas as Chaves',
      message: err.message || 'Todas as tentativas de conexão com a API do Gemini falharam.',
    });

    throw err || new Error('Falha ao conectar com os servidores de IA.');
  }
}

/**
 * Trata e normaliza a resposta JSON estruturada
 */
function parseAndFormatResponse(
  rawContent: string,
  aiModel: string,
  keySlot?: string,
  hedged?: boolean
): VehicleData {
  let parsed: any = {};

  try {
    parsed = JSON.parse(rawContent);
  } catch (_) {
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1]);
      } catch (_) {}
    }

    if (!parsed.placa) {
      const jsonMatches = [...rawContent.matchAll(/\{[\s\S]*?\}/g)];
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        try {
          const candidate = JSON.parse(jsonMatches[i][0]);
          if (candidate.placa || candidate.proprietario || candidate.modelo) {
            parsed = candidate;
            break;
          }
        } catch (_) {}
      }
    }
  }

  if (Array.isArray(parsed) && parsed.length > 0) {
    parsed = parsed[0];
  }

  const sanitizeNoise = (str: any) => {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (
      trimmed === '...' ||
      trimmed === '..' ||
      trimmed === '.' ||
      trimmed === 'valor da placa' ||
      trimmed === 'valor do proprietario' ||
      trimmed === 'valor do carro'
    ) {
      return '';
    }
    return trimmed;
  };

  const rawPlaca = sanitizeNoise(parsed.placa);
  const rawProp = sanitizeNoise(parsed.proprietario);
  const rawMod = sanitizeNoise(parsed.modelo || parsed.carro);
  const rawServ = sanitizeNoise(parsed.servico);

  const placaFormatada = formatPlate(rawPlaca);
  const proprietarioFormatado = formatOwner(rawProp);
  const modeloFormatado = formatModel(rawMod);
  const servicoFormatado = rawServ || 'Troca de óleo e filtro';

  // Identifica campos faltantes para auditoria
  const missingFields: string[] = [];
  if (!placaFormatada) missingFields.push('Placa');
  if (!proprietarioFormatado) missingFields.push('Proprietário');
  if (!modeloFormatado) missingFields.push('Modelo');

  return {
    placa: placaFormatada,
    proprietario: proprietarioFormatado,
    modelo: modeloFormatado,
    servico: servicoFormatado,
    aiModel,
    keySlot,
    hedged,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
    rawText: rawContent,
  };
}
