export interface OcrTelemetryRecord {
  id: string;
  timestamp: number;
  success: boolean;
  durationMs: number;
  model: string;
  placa?: string;
  modelo?: string;
}

export interface DailyMetricsSummary {
  totalToday: number;
  successCount: number;
  successRate: number; // 0 - 100
  avgDurationSec: number;
  fastestDurationSec: number;
  activeModelName: string;
}

const STORAGE_KEY = 'mec_daily_telemetry_v1';
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Horas

/**
 * Busca as métricas consolidadas em tempo real do servidor da VPS (/api/telemetry).
 */
export async function fetchServerDailyMetrics(): Promise<DailyMetricsSummary | null> {
  try {
    const res = await fetch(`/api/telemetry?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.totalToday === 'number') {
      return data as DailyMetricsSummary;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Envia o evento de extração para o servidor Docker da VPS (/api/telemetry).
 */
export async function sendServerTelemetry(
  success: boolean,
  durationMs: number,
  model = 'gemini-3.5-flash-lite',
  placa?: string,
  modelo?: string
): Promise<void> {
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        success,
        durationMs,
        model,
        placa,
        modelo,
      }),
    });
  } catch (err) {
    console.warn('Falha no envio de telemetria para VPS:', err);
  }
}

/**
 * Retorna o timestamp (ms) do início do turno de trabalho atual (03:00 AM no Horário de Brasília).
 */
export function getOperationalDayStartMs(): number {
  const now = new Date();
  // Converte para horário de Brasília (UTC-3)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const brt = new Date(utc - 3 * 3600000);

  const startBrt = new Date(brt);
  if (brt.getHours() < 3) {
    startBrt.setDate(startBrt.getDate() - 1);
  }
  startBrt.setHours(3, 0, 0, 0);

  const diffFromBrt = startBrt.getTime() - brt.getTime();
  return now.getTime() + diffFromBrt;
}

/**
 * Carrega os registros de telemetria locais como fallback.
 */
export function loadDailyRecords(): OcrTelemetryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const records: OcrTelemetryRecord[] = JSON.parse(raw);
    const startMs = getOperationalDayStartMs();

    const valid = records.filter((r) => r.timestamp >= startMs);
    if (valid.length !== records.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch (err) {
    return [];
  }
}

/**
 * Salva localmente como backup.
 */
export function recordOcrTelemetry(
  success: boolean,
  durationMs: number,
  model = 'gemini-3.5-flash-lite',
  placa?: string,
  modelo?: string
): void {
  try {
    const records = loadDailyRecords();
    const newRecord: OcrTelemetryRecord = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      success,
      durationMs: Math.max(durationMs, 400),
      model,
      placa,
      modelo,
    };

    const updated = [newRecord, ...records].slice(0, 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Calcula métricas a partir dos registros locais (Fallback).
 */
export function calculateDailyMetrics(records: OcrTelemetryRecord[]): DailyMetricsSummary {
  if (!records || records.length === 0) {
    return {
      totalToday: 0,
      successCount: 0,
      successRate: 100,
      avgDurationSec: 1.4,
      fastestDurationSec: 1.1,
      activeModelName: 'Gemini 3.5 Flash Lite',
    };
  }

  const totalToday = records.length;
  const successCount = records.filter((r) => r.success).length;
  const successRate = Math.round((successCount / totalToday) * 1000) / 10;

  const totalDuration = records.reduce((acc, r) => acc + r.durationMs, 0);
  const avgDurationSec = Math.round((totalDuration / totalToday / 1000) * 10) / 10;

  const minDuration = Math.min(...records.map((r) => r.durationMs));
  const fastestDurationSec = Math.round((minDuration / 1000) * 10) / 10;

  return {
    totalToday,
    successCount,
    successRate,
    avgDurationSec: avgDurationSec || 1.4,
    fastestDurationSec: fastestDurationSec || 1.1,
    activeModelName: 'Gemini 3.5 Flash Lite',
  };
}
