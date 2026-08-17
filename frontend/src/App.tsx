import { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { ImageViewer } from './components/ImageViewer';
import { ResultPanel } from './components/ResultPanel';
import { PartsSelector } from './components/PartsSelector';
import { OcrProgressBar } from './components/OcrProgressBar';
import { RawTextDrawer } from './components/RawTextDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ChangelogModal } from './components/ChangelogModal';
import { ServiceHistoryDrawer } from './components/ServiceHistoryDrawer';
import { DailyMetricsCard } from './components/DailyMetricsCard';
import { AdminDashboard } from './components/AdminDashboard';
import { useClipboardImage } from './hooks/useClipboardImage';
import { useServiceHistory } from './hooks/useServiceHistory';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useDailyMetrics } from './hooks/useDailyMetrics';
import { useKeyboardShortcuts, ServiceMode } from './hooks/useKeyboardShortcuts';
import { extractWithGemini } from './services/geminiService';
import { extractWithCloudflare } from './services/cloudflareVisionService';
import { sendDiscordSystemAlert } from './services/discordService';
import { CURRENT_APP_VERSION } from './data/changelog';
import {
  playSuccessChime,
  playPasteSound,
  playTrashSound,
} from './utils/soundEffects';
import { ColumnBounds, OcrProgress, OcrWord, ServiceHistoryItem, VehicleData } from './types';
import { validateVehicleData } from './utils/validation';

const DEFAULT_VEHICLE_DATA: VehicleData = {
  placa: '',
  proprietario: '',
  modelo: '',
  servico: 'Troca de óleo e filtro',
};

function getImageSignature(src: string): string {
  const len = src.length;
  const sample = src.slice(0, 80) + src.slice(-80);
  return `${len}_${sample}`;
}

export default function App() {
  // Monitoramento de novas versões para atualização automática
  useAutoUpdate();

  // Telemetria e estatísticas do dia (últimas 24h)
  const { metrics, logExtraction } = useDailyMetrics();

  // Preferências do Usuário (Persistidas no localStorage)
  const [autoCopy, setAutoCopy] = useState<boolean>(() => {
    return localStorage.getItem('mec_auto_copy') !== 'false';
  });
  const autoCopyRef = useRef<boolean>(autoCopy);
  useEffect(() => {
    autoCopyRef.current = autoCopy;
  }, [autoCopy]);

  const [autoPaste, setAutoPaste] = useState<boolean>(() => {
    return localStorage.getItem('mec_auto_paste') !== 'false';
  });

  const [shortcutsEnabled, setShortcutsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('mec_shortcuts_enabled') !== 'false';
  });

  const [showAdminDashboard, setShowAdminDashboard] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.hash === '#admin';
  });

  // Modal de Changelog (Exibe automaticamente 1 vez a cada nova versão)
  const [showChangelogModal, setShowChangelogModal] = useState<boolean>(() => {
    const lastSeen = localStorage.getItem('mec_last_seen_version');
    return lastSeen !== CURRENT_APP_VERSION;
  });

  // Escuta alteração da rota hash (#admin) para abrir o painel oculto
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setShowAdminDashboard(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleToggleAutoCopy = useCallback(() => {
    setAutoCopy((prev) => {
      const next = !prev;
      localStorage.setItem('mec_auto_copy', String(next));
      return next;
    });
  }, []);

  const handleToggleAutoPaste = useCallback(() => {
    setAutoPaste((prev) => {
      const next = !prev;
      localStorage.setItem('mec_auto_paste', String(next));
      if (next) {
        toast.success('Auto-Colar no Alt+Tab Ativado');
      } else {
        toast('Auto-Colar Desativado');
      }
      return next;
    });
  }, []);

  const handleToggleShortcuts = useCallback(() => {
    setShortcutsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('mec_shortcuts_enabled', String(next));
      if (next) {
        toast.success('Atalhos de Teclado Ativados', {
          description: 'Use 1..4 para abas, Enter para copiar e Esc para limpar.',
        });
      } else {
        toast('Atalhos de Teclado Desativados');
      }
      return next;
    });
  }, []);

  const handleOpenAdmin = useCallback(() => {
    setShowAdminDashboard(true);
  }, []);

  const handleCloseAdmin = useCallback(() => {
    setShowAdminDashboard(false);
    if (window.location.hash === '#admin') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Gerenciamento de Imagem com Auto-Colar no foco (Alt+Tab)
  const {
    imageSrc,
    isDragging,
    error,
    setImageSrc,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetImage,
  } = useClipboardImage(autoPaste);

  const [vehicleData, setVehicleData] = useState<VehicleData>(DEFAULT_VEHICLE_DATA);
  const vehicleDataRef = useRef<VehicleData>(vehicleData);
  useEffect(() => {
    vehicleDataRef.current = vehicleData;
  }, [vehicleData]);

  const [columns, setColumns] = useState<ColumnBounds[]>([]);
  const [words, setWords] = useState<OcrWord[]>([]);
  const [rawText, setRawText] = useState<string>('');

  // Histórico de Serviços (24 horas no localStorage) e Sincronização Discord
  const {
    history,
    addService,
    updateCurrentServiceDetails,
    deleteService,
    clearHistory,
  } = useServiceHistory();

  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Timer de Debounce de 5 Segundos para edição no Discord (Proteção contra Rate Limit)
  const serviceDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flag para evitar reprocessar quando carregamos um item do histórico
  const isHistoryRestoreRef = useRef<boolean>(false);

  // Assinatura do último print processado para evitar duplicatas acidentais
  const lastProcessedSignatureRef = useRef<{ signature: string; timestamp: number; data: VehicleData } | null>(null);
  const lastProcessedImageSrcRef = useRef<string | null>(null);

  // Identificador de Processo Ativo e AbortController para prevenir Race Condition
  const activeProcessIdRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Chave do Servidor (.env) protegida
  const envApiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

  // Chave personalizada do usuário no navegador (localStorage)
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    return localStorage.getItem('user_gemini_api_key') || '';
  });

  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Chave ativa prioriza a personalizada do usuário, senão usa a do servidor
  const activeApiKey = userApiKey || envApiKey;
  const activeApiKeyRef = useRef<string>(activeApiKey);
  useEffect(() => {
    activeApiKeyRef.current = activeApiKey;
  }, [activeApiKey]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>({
    status: 'Aguardando imagem...',
    progress: 0,
    stage: 'idle',
  });

  const [showRawDrawer, setShowRawDrawer] = useState<boolean>(false);

  const handleSaveUserKey = useCallback((newKey: string) => {
    setUserApiKey(newKey);
    localStorage.setItem('user_gemini_api_key', newKey);
  }, []);

  // Reset total
  const handleFullReset = useCallback(() => {
    activeProcessIdRef.current++; // Invalida qualquer resposta assíncrona de OCR em andamento
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    if (serviceDebounceTimerRef.current) {
      clearTimeout(serviceDebounceTimerRef.current);
    }
    lastProcessedSignatureRef.current = null;
    lastProcessedImageSrcRef.current = null;
    playTrashSound();
    resetImage();
    setVehicleData(DEFAULT_VEHICLE_DATA);
    setColumns([]);
    setWords([]);
    setRawText('');
    setIsProcessing(false);
    setOcrProgress({ status: 'Aguardando imagem...', progress: 0, stage: 'idle' });
    toast('Painel limpo');
  }, [resetImage]);

  // Função auxiliar para copiar automaticamente para o clipboard (apenas se válido)
  const performAutoCopy = useCallback(
    async (data: VehicleData) => {
      const validation = validateVehicleData(data);
      if (!validation.isValid) {
        toast.warning('Atenção: Preencha os campos obrigatórios!', {
          description: `A IA não identificou: ${validation.missingFields.join(', ')}. Complete para poder copiar.`,
          duration: 4000,
        });
        return;
      }

      if (!autoCopyRef.current) return;

      const placa = data.placa || '[Não identificado]';
      const proprietario = data.proprietario || '[Não identificado]';
      const modelo = data.modelo || '[Não identificado]';
      const servico = data.servico || 'Troca de óleo e filtro';
      const text = `Placa do veículo: ${placa}\nNome do proprietário: ${proprietario}\nModelo do veículo: ${modelo}\nServiço: ${servico}`;

      try {
        await navigator.clipboard.writeText(text);
        playSuccessChime();
        toast.success('Copiado para a área de transferência!', {
          description: `${modelo} • ${placa}`,
          duration: 2500,
        });
      } catch (err) {
        console.warn('Falha no auto-copiar:', err);
      }
    },
    []
  );

  // Execução Ultrarrápida de IA com Fallback Local (Sem travar CPU e sem race condition)
  const processImageOcr = useCallback(
    async (src: string) => {
      // Se foi apenas uma restauração do histórico, não roda o OCR novamente
      if (isHistoryRestoreRef.current) {
        isHistoryRestoreRef.current = false;
        return;
      }

      // Trava Anti-Duplicidade: Se o mesmo print for colado nos últimos 45s, reaproveita dados
      const signature = getImageSignature(src);
      const last = lastProcessedSignatureRef.current;

      if (last && last.signature === signature && Date.now() - last.timestamp < 45000) {
        if (autoCopyRef.current && last.data) {
          performAutoCopy(last.data);
        }
        toast.info('Print já processado recentemente', {
          description: 'Ficha mantida sem consumo extra de IA.',
          duration: 2500,
        });
        return;
      }

      // Cria novo identificador e cancela requisição anterior se existir
      const currentProcessId = ++activeProcessIdRef.current;
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;

      // Cancela qualquer timer de edição pendente do serviço anterior
      if (serviceDebounceTimerRef.current) {
        clearTimeout(serviceDebounceTimerRef.current);
      }

      playPasteSound();
      const startTime = Date.now();

      // Limpa dados anteriores imediatamente ao carregar nova imagem
      setVehicleData(DEFAULT_VEHICLE_DATA);
      setColumns([]);
      setWords([]);
      setRawText('');
      setIsProcessing(true);

      const currentKey = activeApiKeyRef.current;

      // Se tiver chave configurada, executar a IA diretamente em ~1.5s
      if (currentKey && currentKey.trim().length > 0) {
        setOcrProgress({
          status: 'Lendo dados da ficha...',
          progress: 25,
          stage: 'recognizing',
        });

        try {
          const result = await extractWithGemini(src, currentKey, (status, progress) => {
            if (activeProcessIdRef.current === currentProcessId) {
              setOcrProgress({
                status,
                progress,
                stage: 'recognizing',
              });
            }
          });

          // GUARDA DE RACE CONDITION: Se o processo foi cancelado/resetado, aborta imediatamente
          if (activeProcessIdRef.current !== currentProcessId) return;

          const elapsedMs = Date.now() - startTime;
          const isComplete = validateVehicleData(result).isValid;

          const finalDataWithTiming: VehicleData = {
            ...result,
            durationMs: elapsedMs,
          };

          // 1. Atualização Instantânea da Interface e Auto-Copy (0ms de latência percebida)
          setVehicleData(finalDataWithTiming);
          setColumns([]);
          setWords([]);
          setRawText(result.rawText || '');
          setIsProcessing(false);

          addService(finalDataWithTiming, src);
          performAutoCopy(result);

          // Registra assinatura para proteção anti-duplicidade
          lastProcessedSignatureRef.current = {
            signature,
            timestamp: Date.now(),
            data: finalDataWithTiming,
          };

          setOcrProgress({
            status: !isComplete
              ? '⚠️ Ficha com campos incompletos - Preencha para copiar'
              : autoCopyRef.current
              ? '✓ Concluído e copiado com sucesso!'
              : '✓ Ficha extraída com sucesso!',
            progress: 100,
            stage: 'complete',
          });

          // 2. Fire-and-Forget em background: Gravação no SQLite da VPS (Desacoplada da UI)
          setTimeout(() => {
            logExtraction(isComplete, elapsedMs, result.aiModel || 'gemini-3.5-flash-lite', result.placa, result.modelo);
          }, 0);

          return;
        } catch (geminiErr: any) {
          if (activeProcessIdRef.current !== currentProcessId) return;
          console.warn('Gemini excedeu 8s ou está indisponível, acionando contingência Cloudflare Llama 3.2 Vision:', geminiErr);
          setOcrProgress({
            status: 'Conectando ao servidor reserva...',
            progress: 50,
            stage: 'recognizing',
          });
        }
      }

      // Fallback de Contingência Total: Cloudflare Workers AI (Llama 3.2 11B Vision)
      try {
        setOcrProgress({
          status: 'Processando com servidor reserva...',
          progress: 60,
          stage: 'recognizing',
        });

        const result = await extractWithCloudflare(src);

        if (activeProcessIdRef.current !== currentProcessId) return;

        const elapsedMs = Date.now() - startTime;
        const isComplete = validateVehicleData(result).isValid;

        const finalDataWithTiming: VehicleData = {
          ...result,
          durationMs: elapsedMs,
        };

        // 1. Atualização Instantânea da Interface e Auto-Copy (0ms)
        setVehicleData(finalDataWithTiming);
        setColumns([]);
        setWords([]);
        setRawText(result.rawText || '');
        setIsProcessing(false);

        addService(finalDataWithTiming, src);
        performAutoCopy(result);

        // Registra assinatura para proteção anti-duplicidade
        lastProcessedSignatureRef.current = {
          signature,
          timestamp: Date.now(),
          data: finalDataWithTiming,
        };

        setOcrProgress({
          status: !isComplete
            ? '⚠️ Ficha com campos incompletos - Preencha para copiar'
            : autoCopyRef.current
            ? '✓ Concluído e copiado com sucesso!'
            : '✓ Ficha extraída com sucesso!',
          progress: 100,
          stage: 'complete',
        });

        // 2. Fire-and-Forget em background: Alerta informativo Discord e Telemetria SQLite
        setTimeout(() => {
          sendDiscordSystemAlert({
            errorType: 'Contingência Ativada: Cloudflare Llama 3.2 Vision',
            keySlot: 'Cloudflare Workers AI',
            message: 'Google Gemini atingiu tempo limite (8s) ou indisponibilidade. A Cloudflare assumiu e extraiu os dados com sucesso.',
            mentionAdmin: false,
          });

          logExtraction(isComplete, elapsedMs, 'cloudflare-llama-3.2-11b', result.placa, result.modelo);
        }, 0);

        return;
      } catch (err: any) {
        if (activeProcessIdRef.current !== currentProcessId) return;
        console.error('Erro na contingência Cloudflare Vision:', err);

        // Alerta Crítico Real no Discord com menção ao administrador
        setTimeout(() => {
          sendDiscordSystemAlert({
            errorType: 'Falha Total em Todas as IAs (Google Gemini e Cloudflare)',
            keySlot: 'Todas as IAs',
            message: err?.message || 'Nenhum dos servidores de IA conseguiu processar a imagem.',
            mentionAdmin: true,
          });
        }, 0);

        setOcrProgress({
          status: 'Falha na conexão com os servidores de IA.',
          progress: 0,
          stage: 'error',
        });
        toast.error('Erro ao processar imagem com IA');
      } finally {
        if (activeProcessIdRef.current === currentProcessId) {
          setIsProcessing(false);
        }
      }
    },
    [addService, logExtraction, performAutoCopy]
  );

  // Processa automaticamente APENAS quando a imagem mudar
  useEffect(() => {
    if (imageSrc && imageSrc !== lastProcessedImageSrcRef.current) {
      lastProcessedImageSrcRef.current = imageSrc;
      processImageOcr(imageSrc);
    }
  }, [imageSrc, processImageOcr]);

  // Carregar um serviço anterior do histórico para o painel principal (usa a imagem HD do Discord)
  const handleSelectHistoryService = useCallback((item: ServiceHistoryItem) => {
    isHistoryRestoreRef.current = true;
    const bestImage = item.discordImageUrl || item.thumbnailUrl;
    if (bestImage) {
      lastProcessedImageSrcRef.current = bestImage;
      setImageSrc(bestImage);
    }
    setVehicleData(item.vehicleData);
    setRawText(item.vehicleData.rawText || item.formattedText);
    setColumns([]);
    setWords([]);
    setOcrProgress({ status: 'Serviço restaurado do histórico', progress: 100, stage: 'complete' });
    setIsProcessing(false);
    toast.info('Serviço carregado do histórico', { description: `${item.vehicleData.modelo} • ${item.vehicleData.placa}` });
  }, [setImageSrc]);

  // Altera o serviço com Debounce de 5 Segundos (Protege contra Rate Limit do Discord)
  const handleServicoChange = useCallback((newServico: string) => {
    setVehicleData((prev) => {
      const updated = { ...prev, servico: newServico };
      vehicleDataRef.current = updated;
      return updated;
    });

    if (serviceDebounceTimerRef.current) {
      clearTimeout(serviceDebounceTimerRef.current);
    }

    serviceDebounceTimerRef.current = setTimeout(() => {
      updateCurrentServiceDetails(newServico, vehicleDataRef.current);
    }, 5000);
  }, [updateCurrentServiceDetails]);

  // Quando o mecânico clica no botão "Copiar Texto", sincroniza o Discord imediatamente
  const handleManualCopyFlush = useCallback(() => {
    if (serviceDebounceTimerRef.current) {
      clearTimeout(serviceDebounceTimerRef.current);
    }
    updateCurrentServiceDetails(vehicleData.servico, vehicleData);
  }, [updateCurrentServiceDetails, vehicleData]);

  // Atalhos de Teclado Globais (Power User Mode)
  const handleKeyboardServiceSwitch = useCallback(
    (mode: ServiceMode) => {
      if (mode === 'oleo') handleServicoChange('Troca de óleo e filtro');
      else if (mode === 'tuning') handleServicoChange('Troca de peças de performance');
      else if (mode === 'retifica') handleServicoChange('Retífica de motor');
      else if (mode === 'extra') handleServicoChange('Remoção de peça');
      toast.info(`Aba alterada via atalho: ${mode.toUpperCase()}`);
    },
    [handleServicoChange]
  );

  useKeyboardShortcuts({
    enabled: shortcutsEnabled,
    hasImage: Boolean(imageSrc),
    onSwitchServiceMode: handleKeyboardServiceSwitch,
    onCopyFormattedText: handleManualCopyFlush,
    onReset: handleFullReset,
    onToggleHistory: () => setShowHistoryDrawer((prev) => !prev),
    onToggleSettings: () => setShowSettingsModal((prev) => !prev),
    onOpenAdmin: handleOpenAdmin,
  });

  const handleOpenSettings = useCallback(() => setShowSettingsModal(true), []);
  const handleCloseSettings = useCallback(() => setShowSettingsModal(false), []);
  const handleOpenHistory = useCallback(() => setShowHistoryDrawer(true), []);
  const handleCloseHistory = useCallback(() => setShowHistoryDrawer(false), []);
  const handleOpenRawDrawer = useCallback(() => setShowRawDrawer(true), []);
  const handleCloseRawDrawer = useCallback(() => setShowRawDrawer(false), []);
  const handleOpenChangelog = useCallback(() => setShowChangelogModal(true), []);
  const handleCloseChangelog = useCallback(() => setShowChangelogModal(false), []);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200"
    >
      {/* Sistema de Toasts Elegantes Sonner */}
      <Toaster position="bottom-right" richColors theme="dark" closeButton />

      {/* Header */}
      <Header
        onReset={handleFullReset}
        hasImage={Boolean(imageSrc)}
        onOpenSettings={handleOpenSettings}
        historyCount={history.length}
        onOpenHistory={handleOpenHistory}
        autoCopy={autoCopy}
        autoPaste={autoPaste}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-start">
        <div className="space-y-6">
          
          {/* Barra de Progresso quando estiver processando */}
          {(isProcessing || ocrProgress.stage !== 'idle') && (
            <OcrProgressBar progress={ocrProgress} isProcessing={isProcessing} />
          )}

          {!imageSrc ? (
            /* Visualização Inicial: Área de Colar / Drag & Drop + Card de Estatísticas do Dia */
            <div className="space-y-6">
              <DropZone
                onFileInputChange={handleFileInputChange}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                isDragging={isDragging}
                error={error}
              />

              {/* Card de Métricas do Dia (Últimas 24h) */}
              <DailyMetricsCard metrics={metrics} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Linha 1: 2 Colunas Lado a Lado (Imagem Fixa + Dados Extraídos) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Coluna da Esquerda: Visualizador da Imagem com Zoom e Troca Direta */}
                <div className="lg:col-span-7 xl:col-span-7 w-full">
                  <ImageViewer
                    imageSrc={imageSrc}
                    onFileInputChange={handleFileInputChange}
                  />
                </div>

                {/* Coluna da Direita: Painel de Dados Extraídos */}
                <div className="lg:col-span-5 xl:col-span-5 w-full">
                  <ResultPanel
                    data={vehicleData}
                    onDataChange={setVehicleData}
                    onReset={handleFullReset}
                    onOpenRawDrawer={handleOpenRawDrawer}
                    onCopyComplete={handleManualCopyFlush}
                  />
                </div>
              </div>

              {/* Linha 2: Seção Inferior Dedicada de Peças & Modificações (Full Width) */}
              <div className="w-full">
                <PartsSelector
                  currentServico={vehicleData.servico}
                  onServicoChange={handleServicoChange}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Drawer do Histórico de Serviços (24 horas) */}
      <ServiceHistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={handleCloseHistory}
        history={history}
        onSelectService={handleSelectHistoryService}
        onDeleteService={deleteService}
        onClearHistory={clearHistory}
      />

      {/* Modal Flutuante de Configurações e Automações */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={handleCloseSettings}
        autoCopy={autoCopy}
        onToggleAutoCopy={handleToggleAutoCopy}
        autoPaste={autoPaste}
        onToggleAutoPaste={handleToggleAutoPaste}
        shortcutsEnabled={shortcutsEnabled}
        onToggleShortcuts={handleToggleShortcuts}
        userKey={userApiKey}
        hasEnvKey={Boolean(envApiKey)}
        onSaveUserKey={handleSaveUserKey}
        onOpenChangelog={handleOpenChangelog}
        onOpenAdmin={handleOpenAdmin}
      />

      {/* Modal Flutuante de Novidades e Changelog (v2.4.0) */}
      <ChangelogModal
        isOpen={showChangelogModal}
        onClose={handleCloseChangelog}
      />

      {/* Drawer de Texto Bruto do OCR */}
      <RawTextDrawer
        isOpen={showRawDrawer}
        onClose={handleCloseRawDrawer}
        rawText={rawText}
      />

      {/* Painel Administrativo e Auditoria Oculto */}
      <AdminDashboard
        isOpen={showAdminDashboard}
        onClose={handleCloseAdmin}
      />
    </div>
  );
}

