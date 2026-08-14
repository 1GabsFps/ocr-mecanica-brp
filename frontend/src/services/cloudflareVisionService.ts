import { VehicleData } from '../types';
import { formatPlate, formatOwner, formatModel } from './ocrService';
import { compressImageForAi } from '../utils/imagePreprocessing';

export const CLOUDFLARE_ACCOUNT_ID =
  (import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID as string) || '5662e82e2101cdb59a1351361b9c4dbd';

export const CLOUDFLARE_API_TOKEN =
  (import.meta.env.VITE_CLOUDFLARE_API_TOKEN as string) || 'cfut_Er2FS7dLJ9XC2yWlfASdvfqe6CLQvcr7yRGsCg6Yc6e1039e';

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
 * Extrai dados da imagem utilizando a API Cloudflare Workers AI (Llama 3.2 11B Vision)
 */
export async function extractWithCloudflare(
  imageSource: string,
  onProgress?: (modelName: string, modelDisplay: string) => void
): Promise<VehicleData> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Credenciais da Cloudflare Workers AI não configuradas.');
  }

  if (onProgress) {
    onProgress(CLOUDFLARE_VISION_MODEL, 'Cloudflare Llama 3.2 Vision');
  }

  // Comprime a imagem em JPEG
  const compressed = await compressImageForAi(imageSource, 1600, 0.95, 'jpeg');
  const imageBytes = base64ToUint8Array(compressed.base64Data);

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_VISION_MODEL}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
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
function parseCloudflareResponse(rawContent: string): VehicleData {
  let parsed: any = {};

  try {
    parsed = JSON.parse(rawContent);
  } catch (_) {
    // Tenta encontrar bloco ```json ... ```
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1]);
      } catch (_) {}
    }

    // Tenta capturar qualquer objeto JSON { ... }
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
    aiModel: 'cloudflare-llama-3.2-11b',
    keySlot: 'Cloudflare Workers AI',
    hedged: false,
    missingFields,
  };
}
