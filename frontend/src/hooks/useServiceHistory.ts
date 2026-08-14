import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceHistoryItem, VehicleData } from '../types';
import {
  loadHistory,
  saveHistory,
  createHistoryThumbnail,
  copyImageToClipboard,
} from '../utils/historyStorage';
import { uploadImageToDiscord, updateDiscordMessage } from '../services/discordService';

export function useServiceHistory() {
  const [history, setHistory] = useState<ServiceHistoryItem[]>(() => loadHistory());
  const activeItemIdRef = useRef<string | null>(null);

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
      const updated = [newItem, ...filtered].slice(0, 100);
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
          }
        });
      }, 350);
    }

    return itemId;
  }, []);

  const updateCurrentServiceDetails = useCallback((newServico: string, fullData: VehicleData) => {
    const currentId = activeItemIdRef.current;
    if (!currentId) return;

    setHistory((prev) => {
      let targetMessageId: string | undefined;
      let targetPayload: any = null;

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

      // Se já tiver o ID da mensagem no Discord, atualiza via PATCH com os valores originais intactos
      if (targetMessageId && targetPayload) {
        updateDiscordMessage(targetMessageId, targetPayload);
      }

      return updated;
    });
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
