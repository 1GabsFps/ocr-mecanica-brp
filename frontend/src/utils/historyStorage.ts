import { ServiceHistoryItem, VehicleData } from '../types';

const STORAGE_KEY = 'mec_service_history_v1';
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Horas

/**
 * Cria thumbnail leve em JPEG para preview instantâneo na gaveta sem estourar o localStorage.
 */
export async function createHistoryThumbnail(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 480;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.60));
      };
      img.onerror = () => resolve('');
      img.src = imageSrc;
    } catch (_) {
      resolve('');
    }
  });
}

/**
 * Carrega o histórico e remove automaticamente itens com mais de 24h.
 */
export function loadHistory(): ServiceHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const items: ServiceHistoryItem[] = JSON.parse(raw);
    const now = Date.now();

    // Filtra apenas registros dentro das últimas 24 horas
    const valid = items.filter((item) => now - item.timestamp < EXPIRATION_MS);

    // Se houve itens expirados removidos, atualiza o localStorage
    if (valid.length !== items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch (err) {
    console.warn('Erro ao carregar histórico:', err);
    return [];
  }
}

/**
 * Salva a lista de histórico no localStorage.
 */
export function saveHistory(items: ServiceHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err: any) {
    // Se estourar a cota por thumbnails antigos, remove os itens mais antigos e tenta novamente
    if (err.name === 'QuotaExceededError' && items.length > 5) {
      saveHistory(items.slice(0, items.length - 5));
    }
  }
}

/**
 * Converte qualquer Blob de imagem para PNG exigido pela Clipboard API do navegador.
 */
async function convertBlobToPng(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => resolve(b), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Copia uma imagem em Base64 ou URL do Discord diretamente para a área de transferência do usuário (pronto para Ctrl+V).
 * NUNCA copia o link, copia a IMAGEM em si.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  if (!imageUrl) return false;

  try {
    // 1. Se for uma URL do Discord CDN, baixa o binário em alta resolução
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const response = await fetch(imageUrl, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();

          let pngBlob: Blob | null = null;
          if (blob.type === 'image/png') {
            pngBlob = blob;
          } else {
            pngBlob = await convertBlobToPng(blob);
          }

          if (pngBlob) {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': pngBlob,
              }),
            ]);
            return true;
          }
        }
      } catch (fetchErr) {
        console.warn('Falha no fetch direto do Discord CDN, tentando via Canvas Image element:', fetchErr);
      }
    }

    // 2. Fallback via Canvas e elemento Image (funciona com base64 e URLs com CORS)
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob,
              }),
            ]);
            resolve(true);
          } catch (clipErr) {
            console.error('Falha ao escrever imagem no clipboard:', clipErr);
            resolve(false);
          }
        }, 'image/png');
      };
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  } catch (err) {
    console.error('Erro ao copiar imagem:', err);
    return false;
  }
}
