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
import { useAuth } from './hooks/useAuth';
import { MechanicUser } from './services/authService';
import { SteamLoginGate } from './components/SteamLoginGate';
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

export default function App() {
  // Autenticação Steam e Perfil do Mecânico
  const { user, isAuthenticated, isLoading: isAuthLoading, authError, login, logout } = useAuth();
  const userRef = useRef<MechanicUser | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  const processImageOcrRef = useRef<(src: string) => Promise<void>>(async () => {});

  const handleImageLoaded = useCallback((src: string) => {
    processImageOcrRef.current(src);
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
  } = useClipboardImage(autoPaste, handleImageLoaded);

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

  // Flag para evitar reprocessar quando carregamos um item do histórico
  const isHistoryRestoreRef = useRef<boolean>(false);

  // Guarda de tempo de processamento recente
  const lastProcessedTimeRef = useRef<number>(0);
  const lastProcessedSrcRef = useRef<string>('');

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
    lastProcessedTimeRef.current = 0;
    lastProcessedSrcRef.current = '';
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

      // Proteção de 800ms apenas para evitar duplo clique acidental no mesmo milissegundo
      const now = Date.now();
      if (now - lastProcessedTimeRef.current < 800 && lastProcessedSrcRef.current === src) {
        return;
      }
      lastProcessedTimeRef.current = now;
      lastProcessedSrcRef.current = src;

      // Cria novo identificador e cancela requisição anterior se existir
      const currentProcessId = ++activeProcessIdRef.current;
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;

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
          const finalDataWithTiming: VehicleData = {
            ...result,
            durationMs: elapsedMs,
            mechanicSteamHex: userRef.current?.steamHex,
            mechanicName: userRef.current?.nome,
          };

          // 1. Atualização Instantânea da Interface e Auto-Copy (0ms de latência percebida)
          setVehicleData(finalDataWithTiming);
          setColumns([]);
          setWords([]);
          setRawText(result.rawText || '');
          setIsProcessing(false);

          addService(finalDataWithTiming, src);
          performAutoCopy(result);

          setOcrProgress({
            status: !validateVehicleData(result).isValid
              ? '⚠️ Ficha com campos incompletos - Preencha para copiar'
              : autoCopyRef.current
              ? '✓ Concluído e copiado com sucesso!'
              : '✓ Ficha extraída com sucesso!',
            progress: 100,
            stage: 'complete',
          });

          // 2. Fire-and-Forget em background: Gravação no SQLite da VPS (Desacoplada da UI)
          setTimeout(() => {
            logExtraction(
              validateVehicleData(result).isValid,
              elapsedMs,
              result.aiModel || 'gemini-3.5-flash-lite',
              result.placa,
              result.modelo,
              result.servico || 'Troca de óleo e filtro',
              'oleo',
              userRef.current?.steamHex,
              userRef.current?.nome
            );
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
        const finalDataWithTiming: VehicleData = {
          ...result,
          durationMs: elapsedMs,
          mechanicSteamHex: userRef.current?.steamHex,
          mechanicName: userRef.current?.nome,
        };

        // 1. Atualização Instantânea da Interface e Auto-Copy (0ms)
        setVehicleData(finalDataWithTiming);
        setColumns([]);
        setWords([]);
        setRawText(result.rawText || '');
        setIsProcessing(false);

        addService(finalDataWithTiming, src);
        performAutoCopy(result);

        setOcrProgress({
          status: !validateVehicleData(result).isValid
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

          logExtraction(
            validateVehicleData(result).isValid,
            elapsedMs,
            'cloudflare-llama-3.2-11b',
            result.placa,
            result.modelo,
            result.servico || 'Troca de óleo e filtro',
            'oleo',
            userRef.current?.steamHex,
            userRef.current?.nome
          );
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

  // Mantém a referência do processImageOcr sempre atualizada para o useClipboardImage
  useEffect(() => {
    processImageOcrRef.current = processImageOcr;
  }, [processImageOcr]);

  // Carregar um serviço anterior do histórico para o painel principal (usa a imagem HD do Discord)
  const handleSelectHistoryService = useCallback((item: ServiceHistoryItem) => {
    isHistoryRestoreRef.current = true;
    const bestImage = item.discordImageUrl || item.thumbnailUrl;
    if (bestImage) {
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

  // Altera o serviço e sincroniza o histórico e telemetria imediatamente
  const handleServicoChange = useCallback(
    (newServico: string) => {
      setVehicleData((prev) => {
        const updated = {
          ...prev,
          servico: newServico,
          mechanicSteamHex: userRef.current?.steamHex,
          mechanicName: userRef.current?.nome,
        };
        vehicleDataRef.current = updated;
        updateCurrentServiceDetails(newServico, updated);
        return updated;
      });
    },
    [updateCurrentServiceDetails]
  );

  // Quando o mecânico clica no botão "Copiar Texto", força flush imediato
  const handleManualCopyFlush = useCallback(() => {
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

  const handleOpenSettings = useCallback(() => setShowSettingsModal(true), []);
  const handleCloseSettings = useCallback(() => setShowSettingsModal(false), []);
  const handleOpenHistory = useCallback(() => setShowHistoryDrawer(true), []);
  const handleCloseHistory = useCallback(() => setShowHistoryDrawer(false), []);
  const handleOpenRawDrawer = useCallback(() => setShowRawDrawer(true), []);
  const handleCloseRawDrawer = useCallback(() => setShowRawDrawer(false), []);
  const handleOpenChangelog = useCallback(() => setShowChangelogModal(true), []);
  const handleCloseChangelog = useCallback(() => setShowChangelogModal(false), []);

  // Atalho Global Direto para o Painel Administrativo (Ctrl + Shift + A)
  useEffect(() => {
    const handleGlobalAdminShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
        e.preventDefault();
        setShowAdminDashboard(true);
      }
    };
    window.addEventListener('keydown', handleGlobalAdminShortcut);
    return () => window.removeEventListener('keydown', handleGlobalAdminShortcut);
  }, []);

  useKeyboardShortcuts({
    enabled: shortcutsEnabled && isAuthenticated,
    hasImage: Boolean(imageSrc),
    onSwitchServiceMode: handleKeyboardServiceSwitch,
    onCopyFormattedText: handleManualCopyFlush,
    onReset: handleFullReset,
    onToggleHistory: handleOpenHistory,
    onToggleSettings: handleOpenSettings,
    onOpenAdmin: handleOpenAdmin,
  });

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen forged-carbon-bg text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200"
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
        user={user}
        onLogout={logout}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-start">
        {isAuthLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono text-slate-400">Verificando autorização Steam...</p>
          </div>
        ) : !isAuthenticated ? (
          /* Bloqueio de Acesso com Card Oficial Steam */
          <SteamLoginGate onLogin={login} authError={authError} />
        ) : (
          /* Aplicação Completa Desbloqueada para o Mecânico */
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
                      isScanning={isProcessing}
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
        )}
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
