import { useState, useEffect, useCallback } from 'react';
import {
  fetchServerDailyMetrics,
  sendServerTelemetry,
  loadDailyRecords,
  recordOcrTelemetry,
  calculateDailyMetrics,
  DailyMetricsSummary,
} from '../utils/dailyStatsStorage';

export function useDailyMetrics() {
  const [metrics, setMetrics] = useState<DailyMetricsSummary>(() => {
    return calculateDailyMetrics(loadDailyRecords());
  });

  // Atualiza métricas consultando o servidor da VPS
  const refreshMetrics = useCallback(async () => {
    const serverMetrics = await fetchServerDailyMetrics();
    if (serverMetrics) {
      setMetrics(serverMetrics);
    } else {
      // Fallback local caso esteja sem internet / offline
      const localRecords = loadDailyRecords();
      setMetrics(calculateDailyMetrics(localRecords));
    }
  }, []);

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 15 * 1000); // Atualiza a cada 15 segundos
    window.addEventListener('focus', refreshMetrics);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshMetrics);
    };
  }, [refreshMetrics]);

  const logExtraction = useCallback(
    async (success: boolean, durationMs: number, model = 'gemini-3.5-flash-lite', placa?: string, modelo?: string) => {
      // 1. Grava localmente como backup imediato
      recordOcrTelemetry(success, durationMs, model, placa, modelo);

      // 2. Envia para a VPS (Docker Telemetry Service) para somar no painel de todos
      await sendServerTelemetry(success, durationMs, model, placa, modelo);

      // 3. Atualiza os dados imediatamente na tela
      refreshMetrics();
    },
    [refreshMetrics]
  );

  return {
    metrics,
    logExtraction,
    refreshMetrics,
  };
}
