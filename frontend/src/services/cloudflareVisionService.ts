import { VehicleData } from '../types';
import { formatPlate, formatOwner, formatModel } from './ocrService';
import { compressImageForAi } from '../utils/imagePreprocessing';

const CLOUDFLARE_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const SYSTEM_PROMPT = `Você é um extrator de altíssima precisão especialista em HUDs de oficinas mecânicas do GTA RP / FiveM.
Localize a TABELA HORIZONTAL DA OFICINA no CENTRO da tela (cabeçalhos: Placa | Proprietário | Carro | Cor | Modificações | Fipe | IPVA | Multas).
Extraia os dados da linha de dados abaixo dos cabeçalhos.
Retorne OBRIGATORIAMENTE apenas um objeto JSON puro com 3 campos:
{"placa": "STRING", "proprietario": "STRING", "modelo": "STRING"}`;

/**
 * Converte base64 em array de números (uint8) para a API da Cloudflare
 */
function base64ToUint8Array(base64: string): number[] {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extrai dados da imagem utilizando a API Cloudflare Workers AI através do proxy Nginx seguro (sem expor tokens no frontend).
 */
export async function extractWithCloudflare(
  imageSource: string,
  onProgress?: (modelName: string, modelDisplay: string) => void
): Promise<VehicleData> {
  if (onProgress) {
    onProgress(CLOUDFLARE_VISION_MODEL, 'Cloudflare Llama 3.2 Vision');
  }

  // Comprime a imagem em JPEG
  const compressed = await compressImageForAi(imageSource, 1600, 0.95, 'jpeg');
  const imageBytes = base64ToUint8Array(compressed.base64Data);

  const envAccountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID as string;
  const envToken = import.meta.env.VITE_CLOUDFLARE_API_TOKEN as string;

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Em localhost pode usar chave de .env se existir; em produção usa o proxy seguro /api/cloudflare-ai/
  const url = isLocalhost && envAccountId
    ? `https://api.cloudflare.com/client/v4/accounts/${envAccountId}/ai/run/${CLOUDFLARE_VISION_MODEL}`
    : `/api/cloudflare-ai/${CLOUDFLARE_VISION_MODEL}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isLocalhost && envToken) {
    headers['Authorization'] = `Bearer ${envToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        image: imageBytes,
        prompt: SYSTEM_PROMPT,
        max_tokens: 150,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Cloudflare AI Erro ${response.status}: ${JSON.stringify(errorData.errors || errorData)}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Cloudflare AI Falha: ${JSON.stringify(data.errors)}`);
    }

    const rawResponse = data.result?.response || '';
    return parseCloudflareResponse(rawResponse);
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Normaliza e extrai o JSON da resposta da Cloudflare
 */
function parseCloudflareResponse(rawContent: any): VehicleData {
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
    aiModel: 'cloudflare-llama-3.2-11b',
    keySlot: 'Cloudflare Workers AI (Contingência)',
    hedged: false,
    missingFields,
  };
}
