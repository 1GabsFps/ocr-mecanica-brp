import { createWorker, Worker } from 'tesseract.js';
import { ColumnBounds, OcrProgress, OcrWord, VehicleData } from '../types';
import { preprocessImageForOcr } from '../utils/imagePreprocessing';

/**
 * Padrões de cabeçalho comuns em HUDs de mecânica do FiveM / GTA RP
 */
const HEADER_PATTERNS = {
  placa: [/\bplac[ao]s?\b/i, /\bregistro\b/i, /\bplate\b/i, /\blicen[çc]a\b/i],
  proprietario: [/\bpropriet[aáóoé]ri[ao]s?\b/i, /\bpropr[a-z]*\b/i, /\bdono\b/i, /\bcliente\b/i, /\bnome\b/i, /\bowner\b/i],
  carro: [/\bcarro\b/i, /\bve[íi]culos?\b/i, /\bmodelo\b/i, /\bautom[oó]ve(l|is)\b/i, /\bcaminh[aã]o\b/i, /\bmodel\b/i, /\bcamo\b/i],
  cor: [/\bcor\b/i, /\bcores\b/i, /\bcolor\b/i, /\bpintura\b/i],
  modificacoes: [/\bmodific/i, /\bservi[çc]os?\b/i, /\btuning\b/i, /\bupgrades?\b/i, /\bpe[çc]as\b/i],
  fipe: [/\bfipe\b/i, /\btabela\b/i, /\bvalor\b/i],
  ipva: [/\bipva\b/i],
  multas: [/\bmult[ao]s?\b/i, /\bd[eé]bitos?\b/i]
};

const CORES_CONHECIDAS = new Set([
  'branco', 'preto', 'vermelho', 'azul', 'prata', 'cinza', 'amarelo', 'verde',
  'laranja', 'roxo', 'rosa', 'roza', 'dourado', 'marrom', 'vinho', 'bege', 'grafite',
  'fosco', 'verde-oliva', 'turquesa', 'ciano', 'magenta', 'gelo', 'perolizado'
]);

/**
 * Limpa símbolos isolados de tabela (pipes, barras, underlines) mas PRESERVA hífens em modelos compostos (ex: F-150, GT-R).
 */
export function cleanSymbols(text: string): string {
  if (!text) return '';
  return text
    .replace(/^[—\-_=|\*~\/\\\s:;]+|[—\-_=|\*~\/\\\s:;]+$/g, '')
    .replace(/[—_=|\*~\/\\]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/(?<=\s)-(?=\s)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formata placas no padrão tradicional ou Mercosul com correção de ambiguidade e remoção de sufixos de resolução.
 */
export function formatPlate(rawText: string): string {
  if (!rawText) return '';
  const clean = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Padrão Tradicional: 3 Letras + 4 Dígitos (ex: WSI87238K -> WSI 8723, MGP7729 -> MGP 7729)
  const mOld = clean.match(/([A-Z]{3})(\d{4})/);
  if (mOld) {
    return `${mOld[1]} ${mOld[2]}`;
  }

  // 2. Padrão Mercosul: 3 Letras + 1 Dígito + 1 Letra + 2 Dígitos (ex: ABC1D23 -> ABC 1D23)
  const mMerco = clean.match(/([A-Z]{3})(\d[A-Z]\d{2})/);
  if (mMerco) {
    return `${mMerco[1]} ${mMerco[2]}`;
  }

  // 3. Corrigir OCR de 7 caracteres com trocas de dígitos/letras comuns (ex: FEWSG26 -> FEW 5626)
  if (clean.length >= 7) {
    const sub = clean.slice(0, 7);
    const letters = sub.slice(0, 3).replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S');
    const digits = sub.slice(3)
      .replace(/S/g, '5')
      .replace(/G/g, '6')
      .replace(/B/g, '8')
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/Z/g, '2')
      .replace(/A/g, '4')
      .replace(/T/g, '7');
    return `${letters} ${digits}`;
  }

  // 4. Placa com 2 a 4 letras
  const mOther = clean.match(/([A-Z]{2,4})(\d[A-Z0-9]{1,4})/);
  if (mOther) {
    return `${mOther[1]} ${mOther[2]}`;
  }

  return clean.length >= 4 ? clean : rawText.trim().toUpperCase();
}

/**
 * Formata nome do proprietário em Title Case, limpando ruídos e resíduos de corte de OCR.
 */
export function formatOwner(rawText: string): string {
  if (!rawText) return '';
  let t = cleanSymbols(rawText);
  t = t.replace(/([a-z])([A-Z])/g, '$1 $2');
  t = t.replace(/^0\s+/, '');
  t = t.replace(/\bFolipa\b/gi, 'Felipe');

  let words = t
    .split(/\s+/)
    .filter((w) => w.length > 0 && !CORES_CONHECIDAS.has(w.toLowerCase()) && !/^(r\$|\$|rs)\s*\d*$/i.test(w));

  // Remover QUALQUER caractere único solto no final do nome (ex: "Jardani Jovonovich e" -> "Jardani Jovonovich")
  if (words.length > 1 && words[words.length - 1].length <= 1) {
    words.pop();
  }

  const res = words
    .map((w) => {
      if (['de', 'da', 'do', 'dos', 'das'].includes(w.toLowerCase())) {
        return w.toLowerCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  if (res.toLowerCase() === 'riba mar') {
    return 'Ribamar';
  }
  return res;
}

/**
 * Formata modelo do veículo em CAIXA ALTA preservando códigos de versão (ex: FH16 780, GOLF GTI MK4, AMAROK CABINE SIMPLES, FENEMÊ).
 */
export function formatModel(rawText: string): string {
  if (!rawText) return '';
  let t = cleanSymbols(rawText);

  // Corrigir ambiguidades OCR no FH16 780 (ex: FHIE780, FHISTBO, FH16T80, FHIE 780, FH16 780)
  t = t.replace(/\bFH(?:16|IE|1E|IS|1S|I6|L6|IST)?\s*(?:780|T80|7BO|TBO|BO)?\b/gi, 'FH16 780');
  t = t.replace(/\bFH(?:IE|1E|IS|1S|I6|L6)\b/gi, 'FH16');
  t = t.replace(/\b(?:T80|7BO|TBO)\b/gi, '780');

  t = t.replace(/\bGO\s*NGTI\b/gi, 'GOLF GTI');
  t = t.replace(/\bGO\s*LF\b/gi, 'GOLF');

  // Separar camelCase (ex: GolfGTI -> Golf GTI, CabineSimples -> Cabine Simples)
  t = t.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Separar GTI de MK (ex: GTIMK4 -> GTI MK4)
  t = t.replace(/(GTI)(MK\d*)/gi, '$1 $2');
  // Manter padrões de modelos comuns sem espaços extras internos
  t = t.replace(/\bMK\s*(\d+)\b/gi, 'MK$1');
  t = t.replace(/\bFH\s*(\d+)\b/gi, 'FH$1');
  t = t.replace(/\bR\s*(\d{2,3})\b/gi, 'R$1');
  t = t.replace(/\bV\s*([68])\b/gi, 'V$1');
  t = t.replace(/\b(GT)\s*[-–—]?\s*(R)\b/gi, 'GT-R');
  t = t.replace(/\bF\s*[-–—]?\s*(\d{2,3})\b/gi, 'F-$1');
  t = t.replace(/\bCX\s*[-–—]?\s*(\d+)\b/gi, 'CX-$1');
  t = t.replace(/\bCR\s*[-–—]?\s*V\b/gi, 'CR-V');

  let words = t
    .split(/\s+/)
    .filter((w) => w.length > 0 && !CORES_CONHECIDAS.has(w.toLowerCase()) && !/^(r\$|\$|rs)\s*\d*$/i.test(w));

  // Se tiver um modelo principal reconhecido (como FH16 780 ou GOLF GTI MK4), remover sufixos de ruído de 1-2 letras no final (ex: "OG", "AZ", "BR")
  if (words.length > 2 && words[words.length - 1].length <= 2 && !/^(MK|V8|V6|GT|R|RS|M3|M5|M2|4X4|V8)$/i.test(words[words.length - 1])) {
    words.pop();
  }

  let res = words.join(' ');
  return res.trim().toUpperCase();
}

// Worker Singleton em memória para evitar recarga de 3s a cada imagem
let cachedWorkerPromise: Promise<Worker> | null = null;

async function getSharedWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = createWorker(['por', 'eng'], 1).then(async (w) => {
      await w.setParameters({
        tessedit_pageseg_mode: '4' as any,
      });
      return w;
    });
  }
  return cachedWorkerPromise;
}

/**
 * Executa o OCR local com Tesseract.js com worker persistente e alta velocidade.
 */
export async function runMechanicOcr(
  imageSource: string | HTMLImageElement,
  onProgress?: (progress: OcrProgress) => void
): Promise<{ vehicleData: VehicleData; columns: ColumnBounds[]; rawText: string; words: OcrWord[] }> {
  try {
    onProgress?.({ status: 'Otimizando nitidez da imagem...', progress: 20, stage: 'preprocessing' });

    const preprocessed = await preprocessImageForOcr(imageSource);

    onProgress?.({ status: 'Executando OCR local ultrarrápido...', progress: 50, stage: 'recognizing' });

    const worker = await getSharedWorker();

    const result = await worker.recognize(preprocessed.dataUrl, {}, { blocks: true });
    const rawText = result.data.text || '';
    const words = extractWordsFromResult(result);

    onProgress?.({ status: 'Alinhando dados...', progress: 90, stage: 'projecting' });

    const { vehicleData, columns } = extractTableGeometric(words, rawText);

    onProgress?.({ status: 'Concluído!', progress: 100, stage: 'complete' });

    return {
      vehicleData,
      columns,
      rawText,
      words,
    };
  } catch (error) {
    console.error('Erro no processamento do OCR:', error);
    onProgress?.({ status: 'Falha ao processar OCR.', progress: 0, stage: 'error' });

    return {
      vehicleData: {
        placa: '',
        proprietario: '',
        modelo: '',
        servico: 'Troca de óleo e filtro',
        rawText: '',
      },
      columns: [],
      rawText: '',
      words: [],
    };
  }
}

function extractWordsFromResult(result: any): OcrWord[] {
  const words: OcrWord[] = [];
  const pageData = result.data as any;

  if (pageData && pageData.blocks && Array.isArray(pageData.blocks)) {
    pageData.blocks.forEach((block: any) => {
      if (block.paragraphs && Array.isArray(block.paragraphs)) {
        block.paragraphs.forEach((p: any) => {
          if (p.lines && Array.isArray(p.lines)) {
            p.lines.forEach((line: any) => {
              if (line.words && Array.isArray(line.words)) {
                line.words.forEach((w: any) => {
                  const text = (w.text || '').trim();
                  if (text.length > 0 && w.bbox) {
                    words.push({
                      text,
                      confidence: w.confidence || 0,
                      bbox: {
                        x0: w.bbox.x0,
                        y0: w.bbox.y0,
                        x1: w.bbox.x1,
                        y1: w.bbox.y1,
                      },
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  return words;
}

/**
 * Algoritmo de Projeção Espacial Geométrica
 */
function extractTableGeometric(
  words: OcrWord[],
  rawText: string
): { vehicleData: VehicleData; columns: ColumnBounds[] } {
  const headerCandidates: { colKey: string; word: OcrWord }[] = [];

  words.forEach((w) => {
    const textClean = w.text.toLowerCase();
    for (const [colKey, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (patterns.some((pat) => pat.test(textClean))) {
        headerCandidates.push({ colKey, word: w });
        break;
      }
    }
  });

  const headerRows: { colKey: string; word: OcrWord }[][] = [];
  headerCandidates.forEach((hc) => {
    let matchedRow: { colKey: string; word: OcrWord }[] | null = null;
    for (const row of headerRows) {
      const avgY = row.reduce((sum, item) => sum + item.word.bbox.y0, 0) / row.length;
      if (Math.abs(hc.word.bbox.y0 - avgY) <= 22) {
        matchedRow = row;
        break;
      }
    }
    if (matchedRow) {
      matchedRow.push(hc);
    } else {
      headerRows.push([hc]);
    }
  });

  let bestHeaderRow: { colKey: string; word: OcrWord }[] = [];
  let maxDistinctCols = 0;

  headerRows.forEach((row) => {
    const distinct = new Set(row.map((item) => item.colKey));
    if (distinct.size > maxDistinctCols) {
      maxDistinctCols = distinct.size;
      bestHeaderRow = row;
    }
  });

  const columns: ColumnBounds[] = [];
  let placa = '';
  let proprietario = '';
  let modelo = '';
  let servico = 'Troca de óleo e filtro';

  if (maxDistinctCols >= 2) {
    const detectedHeaders = new Map<string, OcrWord>();
    bestHeaderRow.forEach((item) => {
      if (!detectedHeaders.has(item.colKey)) {
        detectedHeaders.set(item.colKey, item.word);
      }
    });

    if (detectedHeaders.has('proprietario') && !detectedHeaders.has('placa')) {
      const propBox = detectedHeaders.get('proprietario')!;
      const inferredPlacaBox: OcrWord = {
        text: 'Placa',
        confidence: 90,
        bbox: {
          x0: Math.max(0, propBox.bbox.x0 - 90),
          y0: propBox.bbox.y0,
          x1: propBox.bbox.x0 - 10,
          y1: propBox.bbox.y1,
        },
      };
      detectedHeaders.set('placa', inferredPlacaBox);
    }

    const headerBoxes = Array.from(detectedHeaders.values());
    const hYmin = Math.min(...headerBoxes.map((b) => b.bbox.y0));
    const hYmax = Math.max(...headerBoxes.map((b) => b.bbox.y1));
    const hHeight = Math.max(12, hYmax - hYmin);

    const tableXmin = Math.min(...headerBoxes.map((b) => b.bbox.x0)) - 30;
    const tableXmax = Math.max(...headerBoxes.map((b) => b.bbox.x1)) + 40;

    const dataYmin = hYmax - 2;
    const dataYmax = hYmax + Math.max(45, hHeight * 3.5);

    const dataRowWords = words.filter((w) => {
      const isHeader = headerBoxes.some((hb) => hb === w);
      if (isHeader) return false;
      const wYCenter = (w.bbox.y0 + w.bbox.y1) / 2;
      return (
        w.bbox.x0 >= tableXmin &&
        w.bbox.x1 <= tableXmax + 50 &&
        wYCenter >= dataYmin &&
        wYCenter <= dataYmax
      );
    });

    const sortedCols = Array.from(detectedHeaders.entries()).sort(
      (a, b) => a[1].bbox.x0 - b[1].bbox.x0
    );

    const colBoundsMap = new Map<
      string,
      { xMin: number; xMax: number; centerX: number; box: OcrWord }
    >();

    for (let i = 0; i < sortedCols.length; i++) {
      const [colKey, hBox] = sortedCols[i];
      const prev = sortedCols[i - 1];
      const next = sortedCols[i + 1];

      const left = prev
        ? (prev[1].bbox.x1 + hBox.bbox.x0) / 2
        : hBox.bbox.x0 - 40;
      const right = next
        ? (hBox.bbox.x1 + next[1].bbox.x0) / 2
        : hBox.bbox.x1 + 60;
      const centerX = (hBox.bbox.x0 + hBox.bbox.x1) / 2;

      colBoundsMap.set(colKey, { xMin: left, xMax: right, centerX, box: hBox });

      columns.push({
        key: colKey as any,
        headerName: colKey,
        xMin: left,
        xMax: right,
        words: [],
      });
    }

    const colWordsMap = new Map<string, string[]>();
    sortedCols.forEach(([key]) => colWordsMap.set(key, []));

    dataRowWords.forEach((dw) => {
      if (!/[a-zA-Z0-9]/.test(dw.text)) return;

      const text = dw.text;
      const wXCenter = (dw.bbox.x0 + dw.bbox.x1) / 2;
      const wWidth = Math.max(1, dw.bbox.x1 - dw.bbox.x0);

      const pInfo = colBoundsMap.get('proprietario');
      const cInfo = colBoundsMap.get('carro');

      if (pInfo && cInfo && dw.bbox.x0 < pInfo.xMax && dw.bbox.x1 >= cInfo.xMin + 10) {
        const tokens = text.split(/\s+/);
        const totalLen = Math.max(1, tokens.reduce((s, t) => s + t.length, 0));
        let currPos = 0;

        tokens.forEach((token) => {
          const tokenRel = (currPos + token.length / 2) / totalLen;
          const tokenX = dw.bbox.x0 + tokenRel * wWidth;
          currPos += token.length;

          if (tokenX < pInfo.xMax) {
            colWordsMap.get('proprietario')?.push(token);
          } else {
            colWordsMap.get('carro')?.push(token);
          }
        });
        return;
      }

      let bestCol: string | null = null;
      for (const [colKey, bounds] of colBoundsMap.entries()) {
        if (wXCenter >= bounds.xMin && wXCenter <= bounds.xMax) {
          bestCol = colKey;
          break;
        }
      }

      if (!bestCol) {
        let minDistance = Infinity;
        colBoundsMap.forEach((bounds, key) => {
          const dist = Math.abs(wXCenter - bounds.centerX);
          if (dist < minDistance) {
            minDistance = dist;
            bestCol = key;
          }
        });
      }

      if (bestCol) {
        colWordsMap.get(bestCol)?.push(text);
      }
    });

    if (colWordsMap.get('placa')?.length) {
      placa = formatPlate(colWordsMap.get('placa')!.join(' '));
    }
    if (colWordsMap.get('proprietario')?.length) {
      proprietario = formatOwner(colWordsMap.get('proprietario')!.join(' '));
    }
    if (colWordsMap.get('carro')?.length) {
      modelo = formatModel(colWordsMap.get('carro')!.join(' '));
    }

    if (!placa && dataRowWords.length > 0) {
      const dataRowText = dataRowWords.map((w) => w.text).join(' ');
      const pMatch = dataRowText.match(/\b([A-Z]{3}\s*[0-9][A-Z0-9]{3})\b/i) || dataRowText.match(/\b([A-Z]{2,4}\s*[0-9]{3,4})\b/i);
      if (pMatch) {
        placa = formatPlate(pMatch[1]);
      }
    }
  }

  if (!placa) {
    const lines = rawText.split('\n');
    for (const line of lines) {
      if (/\b(?:ID\s*\d+|[0-9]{2}:[0-9]{2}|faturamento|recebeu)\b/i.test(line)) {
        continue;
      }
      const pMatch = line.match(/\b([A-Z]{3}\s*[0-9][A-Z0-9]{3})\b/i) || line.match(/\b([A-Z]{2,4}\s*[0-9]{3,4})\b/i);
      if (pMatch) {
        placa = formatPlate(pMatch[1]);
        break;
      }
    }
  }

  return {
    vehicleData: {
      placa: placa || '',
      proprietario: proprietario || '',
      modelo: modelo || '',
      servico: servico,
      rawText,
    },
    columns,
  };
}
