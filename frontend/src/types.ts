export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
  bbox: BoundingBox;
}

export interface ColumnBounds {
  key: keyof VehicleData | 'other';
  headerName: string;
  xMin: number;
  xMax: number;
  words: OcrWord[];
}

export interface VehicleData {
  placa: string;
  proprietario: string;
  modelo: string;
  servico: string;
  aiModel?: string; // Ex: 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'tesseract-local'
  durationMs?: number; // Tempo de processamento em ms
  keySlot?: string; // Ex: 'Chave #1 (Principal)', 'Chave #2 (Reserva)'
  hedged?: boolean; // Se a chave reserva foi acionada para salvar a requisição
  missingFields?: string[]; // Campos que a IA não conseguiu identificar
  cor?: string;
  fipe?: string;
  ipva?: string;
  multas?: string;
  rawText?: string;
}

export interface ServiceHistoryItem {
  id: string;
  timestamp: number; // Unix timestamp em ms
  vehicleData: VehicleData;
  thumbnailUrl?: string; // Imagem comprimida para preview rápido no drawer
  discordImageUrl?: string; // Link direto da imagem em alta resolução no Discord CDN
  discordMessageId?: string; // ID da mensagem no Discord para edições (PATCH)
  formattedText: string;
}

export interface OcrProgress {
  status: string;
  progress: number;
  stage: 'idle' | 'loading_worker' | 'preprocessing' | 'recognizing' | 'projecting' | 'complete' | 'error';
  badge?: string;
  badgeType?: 'default' | 'hedge' | 'switch' | 'cloudflare' | 'success' | 'error';
}

export interface ZoomState {
  scale: number;
  positionX: number;
  positionY: number;
}
