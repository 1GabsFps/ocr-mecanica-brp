/**
 * Utilitários de normalização de dados OCR e pós-processamento de texto para GTA RP / FiveM.
 */

const CORES_CONHECIDAS = new Set([
  'branco', 'preto', 'vermelho', 'azul', 'prata', 'cinza', 'amarelo', 'verde',
  'laranja', 'roxo', 'rosa', 'roza', 'dourado', 'marrom', 'vinho', 'bege', 'grafite',
  'fosco', 'verde-oliva', 'turquesa', 'ciano', 'magenta', 'gelo', 'perolizado'
]);

/**
 * Limpa símbolos isolados de tabela (pipes, barras, underlines) mas PRESERVA hífens em modelos compostos (ex: F-150, GT-R).
 */
export function cleanSymbols(text: any): string {
  if (text === null || text === undefined) return '';
  const str = typeof text === 'string' ? text : String(text);
  return str
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
export function formatPlate(rawText: any): string {
  if (rawText === null || rawText === undefined) return '';
  const str = typeof rawText === 'string' ? rawText : String(rawText);
  const clean = str.toUpperCase().replace(/[^A-Z0-9]/g, '');

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

    const combined = letters + digits;
    const m1 = combined.match(/([A-Z]{3})(\d{4})/);
    if (m1) return `${m1[1]} ${m1[2]}`;

    const m2 = combined.match(/([A-Z]{3})(\d[A-Z]\d{2})/);
    if (m2) return `${m2[1]} ${m2[2]}`;
  }

  // 4. Placas curtas ou formatos FiveM especiais (ex: 2 a 4 caracteres)
  return clean.length >= 4 ? clean : str.trim().toUpperCase();
}

/**
 * Formata nome do proprietário em Title Case, limpando ruídos e resíduos de corte de OCR.
 */
export function formatOwner(rawText: any): string {
  if (rawText === null || rawText === undefined) return '';
  const str = typeof rawText === 'string' ? rawText : String(rawText);
  let t = cleanSymbols(str);
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
export function formatModel(rawText: any): string {
  if (rawText === null || rawText === undefined) return '';
  const str = typeof rawText === 'string' ? rawText : String(rawText);
  let t = cleanSymbols(str);

  // Corrigir ambiguidades OCR no FH16 780 com exigência de padrão sem corromper outros FH (ex: FH 540)
  t = t.replace(/\bFH(?:16|IE|1E|IS|1S|I6|L6|IST)\s*(?:780|T80|7BO|TBO|BO)\b/gi, 'FH16 780');
  t = t.replace(/\bFH\s*(?:780|T80|7BO|TBO)\b/gi, 'FH16 780');
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

  // Correções semânticas de veículos comuns no GTA RP
  t = t.replace(/\bFONEM[EÊ]\b/gi, 'FENEMÊ');
  t = t.replace(/\bMARE[\s\-_]*A\b/gi, 'MAREA');
  t = t.replace(/\bRAPTOR\b/gi, 'RAPTOR');

  let words = t.split(/\s+/).filter((w) => w.length > 0 && !CORES_CONHECIDAS.has(w.toLowerCase()));

  // Se tiver um modelo principal reconhecido (como FH16 780 ou GOLF GTI MK4), remover sufixos de ruído de 1-2 letras no final (ex: "OG", "AZ", "BR")
  if (words.length > 2 && words[words.length - 1].length <= 2 && !/^(MK|V8|V6|GT|R|RS|M3|M5|M2|4X4|V8)$/i.test(words[words.length - 1])) {
    words.pop();
  }

  let res = words.join(' ');
  return res.trim().toUpperCase();
}
