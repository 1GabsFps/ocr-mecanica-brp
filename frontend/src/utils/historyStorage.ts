import { ServiceHistoryItem } from '../types';

export const MAX_HISTORY_ITEMS = 30; // 30 itens x ~3KB = ~90KB (< 2% da cota do localStorage)
const STORAGE_KEY = 'mec_service_history_v1';
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Horas

/**
 * Cria thumbnail micro ultra-comprimida em JPEG (<3KB, max 160px, qualidade 0.45)
 */
export async function createHistoryThumbnail(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 160;
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
          canvas.width = 0;
          canvas.height = 0;
          resolve('');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
        canvas.width = 0;
        canvas.height = 0;
        resolve(dataUrl);
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

    // Filtra apenas registros dentro das últimas 24 horas e respeita o teto
    const valid = items
      .filter((item) => now - item.timestamp < EXPIRATION_MS)
      .slice(0, MAX_HISTORY_ITEMS);

    // Se houve itens expirados ou excedentes removidos, atualiza o localStorage
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
 * Salva a lista de histórico no localStorage com limite de 30 itens.
 */
export function saveHistory(items: ServiceHistoryItem[]): void {
  try {
    const trimmed = items.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err: any) {
    // Se estourar a cota, remove os itens mais antigos e tenta novamente
    if (err.name === 'QuotaExceededError' && items.length > 5) {
      saveHistory(items.slice(0, items.length - 5));
    }
  }
}

/**
 * Copia a imagem preservando o user gesture síncrono via ClipboardItem com Promise<Blob>
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  if (!imageUrl) return false;

  try {
    const blobPromise = new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          canvas.width = 0;
          canvas.height = 0;
          reject(new Error('Canvas 2D context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          canvas.width = 0;
          canvas.height = 0;
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to PNG blob'));
          }
        }, 'image/png');
      };
      img.onerror = (e) => reject(e);
      img.src = imageUrl;
    });

    // Invoca o write do Clipboard sincronicamente dentro do gesto do usuário
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blobPromise,
      }),
    ]);
    return true;
  } catch (err) {
    console.error('Erro ao copiar imagem:', err);
    return false;
  }
}

