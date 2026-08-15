import { VehicleData } from '../types';
import { formatPlate, formatOwner, formatModel } from './ocrService';
import { compressImageForAi } from '../utils/imagePreprocessing';
import { sendDiscordSystemAlert } from './discordService';

// Modelo principal ultra-calibrado para visão computacional rápida e precisa
export const PRIMARY_MODEL = 'gemini-3.5-flash-lite';

// Rotação sequencial entre as chaves cadastradas
let keyRotationIndex = 0;

/**
 * Normaliza e separa as chaves de API caso o usuário passe múltiplas separadas por vírgula ou ponto-e-vírgula.
 */
export function parseApiKeys(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[,;\n\r]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 5);
}

const SYSTEM_PROMPT = `Você é um extrator de alta precisão especializado em HUDs de oficinas mecânicas do GTA RP / FiveM.
Localize a TABELA HORIZONTAL no CENTRO da tela (cabeçalhos: Placa | Proprietário | Carro | Cor | Modificações | Fipe | IPVA | Multas).
Extraia os dados da linha de dados abaixo dos cabeçalhos.
Retorne OBRIGATORIAMENTE apenas um objeto JSON puro:
{"placa": "STRING", "proprietario": "STRING", "modelo": "STRING"}`;

/**
 * Executa uma chamada direta e limpa para a API do Gemini.
 */
async function executeGeminiRequest(
  apiKey: string,
  model: string,
  compressed: { base64Data: string; mimeType: string },
  signal: AbortSignal,
  keySlotName?: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
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
        temperature: 0.0,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Erro ${response.status}: ${response.statusText}`;

    // Alerta de log informativo no Discord se bater 503, Cota 429 ou Alerta Crítico se for Chave Inválida
    if (response.status === 503) {
      sendDiscordSystemAlert({
        errorType: 'Google Gemini Sobrecarregado (503 Service Unavailable)',
        keySlot: keySlotName || 'Chave do Pool',
        message: 'Servidores de GPU do Google em alta demanda momentânea.',
        code: 503,
        mentionAdmin: false,
      });
    } else if (response.status === 429) {
      sendDiscordSystemAlert({
        errorType: 'Cota de Requisições Atingida no Gemini (429)',
        keySlot: keySlotName || 'Chave do Pool',
        message: 'Cota por minuto/dia atingida. Alternando chave.',
        code: 429,
        mentionAdmin: false,
      });
    } else if (response.status === 400 || response.status === 403) {
      sendDiscordSystemAlert({
        errorType: `Erro de Autenticação na Chave (${response.status})`,
        keySlot: keySlotName || 'Chave do Pool',
        message,
        code: response.status,
        mentionAdmin: true,
      });
    }

    const err: any = new Error(message);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return rawContent;
}

export type GeminiProgressCallback = (status: string, progress: number) => void;

/**
 * Extração sequencial robusta e sem desperdício de tokens:
 * 1. Envia uma única requisição com timeout adequado de 25s (permitindo a IA responder sem cortes).
 * 2. Somente em caso de erro real (503, 429, falha de rede), tenta a próxima chave do pool.
 * 3. Se todas as chaves do Google falharem, propaga o erro para acionar a Cloudflare.
 */
export async function extractWithGemini(
  imageDataUrl: string,
  apiKeyInput: string,
  onStatusUpdate?: GeminiProgressCallback
): Promise<VehicleData> {
  const keys = parseApiKeys(apiKeyInput);
  if (keys.length === 0) {
    throw new Error('Chave de API não configurada.');
  }

  onStatusUpdate?.('Processando imagem com IA...', 30);

  // Pré-processamento em Ultra-HD JPEG
  const compressed = await compressImageForAi(imageDataUrl, 1600, 0.95, 'jpeg');

  const startIndex = keyRotationIndex % keys.length;
  let lastError: any = null;

  // Tenta as chaves disponíveis de forma sequencial e paciente
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentIdx = (startIndex + attempt) % keys.length;
    const currentKey = keys[currentIdx];
    const slotName = `Chave #${currentIdx + 1}${keys.length > 1 ? (attempt === 0 ? ' (Principal)' : ' (Reserva)') : ''}`;

    if (attempt > 0) {
      onStatusUpdate?.('Tentando chave reserva...', 50);
    }

    const controller = new AbortController();
    // Timeout paciente de 25 segundos para não matar requisições em andamento
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const raw = await executeGeminiRequest(currentKey, PRIMARY_MODEL, compressed, controller.signal, slotName);
      clearTimeout(timeoutId);

      // Avança a rotação para a próxima requisição
      keyRotationIndex = (currentIdx + 1) % keys.length;

      return parseAndFormatResponse(raw, PRIMARY_MODEL, slotName, attempt > 0);
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`[Gemini] Falha na ${slotName}:`, err?.message || err);
      // Continua para a próxima chave do pool caso haja mais de uma
    }
  }

  // Se todas as chaves do Google falharem, lança o erro para o App.tsx acionar a Cloudflare
  throw lastError || new Error('Google Gemini indisponível.');
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

  const rawPlaca = parsed.placa || '';
  const rawProprietario = parsed.proprietario || '';
  const rawModelo = parsed.modelo || parsed.carro || '';

  const placa = formatPlate(rawPlaca);
  const proprietario = formatOwner(rawProprietario);
  const modelo = formatModel(rawModelo);

  const missingFields: string[] = [];
  if (!placa) missingFields.push('Placa');
  if (!proprietario) missingFields.push('Proprietário');
  if (!modelo) missingFields.push('Modelo');

  return {
    placa,
    proprietario,
    modelo,
    servico: 'Troca de óleo e filtro',
    rawText: rawContent,
    aiModel,
    keySlot,
    hedged: !!hedged,
    missingFields,
  };
}
