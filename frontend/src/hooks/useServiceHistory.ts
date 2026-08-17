import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceHistoryItem, VehicleData } from '../types';
import {
  loadHistory,
  saveHistory,
  createHistoryThumbnail,
  copyImageToClipboard,
  MAX_HISTORY_ITEMS,
} from '../utils/historyStorage';
import { uploadImageToDiscord, updateDiscordMessage } from '../services/discordService';

export function useServiceHistory() {
  const [history, setHistory] = useState<ServiceHistoryItem[]>(() => loadHistory());
  const activeItemIdRef = useRef<string | null>(null);
  const pendingDiscordUpdatesRef = useRef<Map<string, any>>(new Map());

  // Atualiza e limpa expirados a cada carregamento ou a cada 10 minutos
  useEffect(() => {
    const refresh = () => setHistory(loadHistory());
    refresh();
    const timer = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const addService = useCallback(async (data: VehicleData, imageSrc: string) => {
    // Evita salvar se todos os campos principais estiverem vazios
    if (!data.placa && !data.proprietario && !data.modelo) {
      return null;
    }

    const placa = data.placa || '[Sem Placa]';
    const proprietario = data.proprietario || '[Sem Nome]';
    const modelo = data.modelo || '[Veículo Desconhecido]';
    const servico = data.servico || 'Troca de óleo e filtro';

    const formattedText = `Placa do veículo: ${placa}\nNome do proprietário: ${proprietario}\nModelo do veículo: ${modelo}\nServiço: ${servico}`;

    const thumbnailUrl = imageSrc ? await createHistoryThumbnail(imageSrc) : '';
    const itemId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    activeItemIdRef.current = itemId;

    const newItem: ServiceHistoryItem = {
      id: itemId,
      timestamp: Date.now(),
      vehicleData: { ...data },
      thumbnailUrl,
      formattedText,
    };

    setHistory((prev) => {
      // Evita duplicatas idênticas consecutivas no mesmo minuto
      const filtered = prev.filter(
        (p) => !(p.vehicleData.placa === data.placa && p.vehicleData.modelo === data.modelo && Date.now() - p.timestamp < 30000)
      );
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(updated);
      return updated;
    });

    // Envio em Segundo Plano com Fila Otimizada (Não bloqueia nem disputa banda com a IA)
    if (imageSrc) {
      setTimeout(() => {
        uploadImageToDiscord(imageSrc, data).then((discordResult) => {
          if (discordResult && discordResult.url) {
            setHistory((prev) => {
              const updated = prev.map((item) => {
                if (item.id === itemId) {
                  return {
                    ...item,
                    discordImageUrl: discordResult.url,
                    discordMessageId: discordResult.messageId,
                  };
                }
                return item;
              });
              saveHistory(updated);
              return updated;
            });

            // Se o usuário já alterou o serviço enquanto o upload estava em andamento, sincroniza imediatamente
            const pendingPayload = pendingDiscordUpdatesRef.current.get(itemId);
            if (pendingPayload && discordResult.messageId) {
              updateDiscordMessage(discordResult.messageId, pendingPayload);
              pendingDiscordUpdatesRef.current.delete(itemId);
            }
          }
        });
      }, 350);
    }

    return itemId;
  }, []);

  const discordDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCurrentServiceDetails = useCallback((newServico: string, fullData: VehicleData) => {
    const currentId = activeItemIdRef.current;
    if (!currentId) return;

    let targetMessageId: string | undefined;
    let targetPayload: any = null;

    setHistory((prev) => {
      const updated = prev.map((item) => {
        if (item.id === currentId) {
          targetMessageId = item.discordMessageId;

          // Preserva estritamente o tempo de resposta, modelo e auditoria de chaves originais
          const originalDuration = item.vehicleData.durationMs ?? fullData.durationMs;
          const originalModel = item.vehicleData.aiModel || fullData.aiModel || 'gemini-3.5-flash-lite';
          const originalKeySlot = item.vehicleData.keySlot || fullData.keySlot;
          const originalHedged = item.vehicleData.hedged ?? fullData.hedged;
          const originalMissing = item.vehicleData.missingFields || fullData.missingFields;

          const updatedVehicle: VehicleData = {
            ...item.vehicleData,
            ...fullData,
            servico: newServico,
            durationMs: originalDuration,
            aiModel: originalModel,
            keySlot: originalKeySlot,
            hedged: originalHedged,
            missingFields: originalMissing,
          };
          const placa = updatedVehicle.placa || '[Sem Placa]';
          const proprietario = updatedVehicle.proprietario || '[Sem Nome]';
          const modelo = updatedVehicle.modelo || '[Veículo Desconhecido]';

          targetPayload = {
            placa,
            proprietario,
            modelo,
            servico: newServico,
            aiModel: originalModel,
            durationMs: originalDuration,
            keySlot: originalKeySlot,
            hedged: originalHedged,
            missingFields: originalMissing,
          };

          return {
            ...item,
            vehicleData: updatedVehicle,
            formattedText: `Placa do veículo: ${placa}\nNome do proprietário: ${proprietario}\nModelo do veículo: ${modelo}\nServiço: ${newServico}`,
          };
        }
        return item;
      });

      saveHistory(updated);
      return updated;
    });

    if (targetPayload) {
      // 1. Sincronização IMEDIATA com o Banco de Dados SQLite VPS (0ms)
      const s = newServico.toLowerCase();
      let calculatedMode = 'oleo';
      if (s.includes('retifica') || s.includes('retífica') || s.includes('bloco') || s.includes('pist') || s.includes('biela') || s.includes('cabeçote') || s.includes('cabecote') || s.includes('virabrequim') || s.includes('cilindro') || s.includes('turbina')) {
        calculatedMode = 'retifica';
      } else if (s.includes('performance') || s.includes('tuning') || s.includes('freio') || s.includes('pneu') || s.includes('suspens') || s.includes('dire')) {
        calculatedMode = 'tuning';
      } else if (s.includes('remocao') || s.includes('remoção')) {
        calculatedMode = 'extra';
      }

      fetch('/api/telemetry/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: targetPayload.placa,
          servico: newServico,
          serviceMode: calculatedMode,
          mechanicSteamHex: fullData.mechanicSteamHex,
          mechanicName: fullData.mechanicName,
        }),
      }).catch(() => {
        // Falhas de rede de telemetria não bloqueiam a UI
      });

      // 2. Sincronização com Discord (com debounce inteligente de 1.2s para evitar Rate Limit 429)
      if (discordDebounceTimerRef.current) {
        clearTimeout(discordDebounceTimerRef.current);
      }

      discordDebounceTimerRef.current = setTimeout(() => {
        if (targetMessageId) {
          updateDiscordMessage(targetMessageId, targetPayload);
        } else {
          pendingDiscordUpdatesRef.current.set(currentId, targetPayload);
        }
      }, 1200);
    }
  }, []);

  const deleteService = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return {
    history,
    addService,
    updateCurrentServiceDetails,
    activeItemIdRef,
    deleteService,
    clearHistory,
    copyImageToClipboard,
  };
}
