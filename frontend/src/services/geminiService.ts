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
 * Executa uma chamada direta para a API do Gemini via Proxy Nginx Keep-Alive (ou direto em localhost).
 */
async function executeGeminiRequest(
  apiKey: string,
  model: string,
  compressed: { base64Data: string; mimeType: string },
  signal: AbortSignal,
  keySlotName?: string
): Promise<string> {
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const baseUrl = isLocalhost
    ? 'https://generativelanguage.googleapis.com/'
    : '/api/gemini-ai/';

  const url = `${baseUrl}v1beta/models/${model}:generateContent?key=${apiKey}`;

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

    if (response.status === 503) {
      sendDiscordSystemAlert({
        errorType: 'Google Gemini Sobrecarregado (503 Service Unavailable)',
        keySlot: keySlotName || 'Chave do Pool',
        message: 'Servidores de GPU do Google em alta demanda. Acionando Cloudflare Vision.',
        code: 503,
        mentionAdmin: false,
      });
    } else if (response.status === 429) {
      sendDiscordSystemAlert({
        errorType: 'Cota de Requisições Atingida no Gemini (429)',
        keySlot: keySlotName || 'Chave do Pool',
        message: 'Cota de requisições excedida no Gemini. Acionando Cloudflare Vision.',
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
 * Extração de alta velocidade e baixa latência:
 * - Dispara para a chave ativa via rota Keep-Alive com timeout de 8 segundos.
 * - Se a requisição do Google enfileirar (>8s) ou retornar erro (503/429), transfere
 *   imediatamente para a Cloudflare Llama 3.2 Vision, sem desperdiçar tempo na mesma infraestrutura.
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

  // Pré-processamento ultra-leve (1280px, 85% de qualidade -> ~40KB de payload)
  const compressed = await compressImageForAi(imageDataUrl, 1280, 0.85, 'jpeg');

  const currentIdx = keyRotationIndex % keys.length;
  const currentKey = keys[currentIdx];
  const slotName = `Chave #${currentIdx + 1}${keys.length > 1 ? (currentIdx === 0 ? ' (Principal)' : ' (Reserva)') : ''}`;

  const controller = new AbortController();
  // Timeout calibrado de 14s: suficiente para conexões variáveis sem abortar chamadas ativas
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const raw = await executeGeminiRequest(currentKey, PRIMARY_MODEL, compressed, controller.signal, slotName);
    clearTimeout(timeoutId);

    // Avança a rotação de chave para a próxima requisição
    keyRotationIndex = (currentIdx + 1) % keys.length;

    return parseAndFormatResponse(raw, PRIMARY_MODEL, slotName, false);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[Gemini] Falha ou timeout de 8s na ${slotName}, pulando direto para Cloudflare:`, err?.message || err);
    throw err || new Error('Google Gemini demorou mais de 8s ou está indisponível.');
  }
}

/**
 * Trata e normaliza a resposta JSON estruturada
 */
function parseAndFormatResponse(
  rawContent: any,
  aiModel: string,
  keySlot?: string,
  hedged?: boolean
): VehicleData {
  let parsed: any = {};

  if (typeof rawContent === 'object' && rawContent !== null) {
    parsed = rawContent;
  } else {
    const text = typeof rawContent === 'string' ? rawContent : String(rawContent || '');
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          parsed = JSON.parse(codeBlockMatch[1]);
        } catch (_) {}
      }

      if (!parsed || typeof parsed !== 'object' || !parsed.placa) {
        const jsonMatches = [...text.matchAll(/\{[\s\S]*?\}/g)];
        for (let i = jsonMatches.length - 1; i >= 0; i--) {
          try {
            const candidate = JSON.parse(jsonMatches[i][0]);
            if (candidate && typeof candidate === 'object' && (candidate.placa || candidate.proprietario || candidate.modelo)) {
              parsed = candidate;
              break;
            }
          } catch (_) {}
        }
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    parsed = {};
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
    rawText: typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent || {}),
    aiModel,
    keySlot,
    hedged: !!hedged,
    missingFields,
  };
}
