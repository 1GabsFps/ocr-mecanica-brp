import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Copy,
  Check,
  Trash2,
  Car,
  Tag,
  User,
  Wrench,
  Clock,
  Search,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { ServiceHistoryItem } from '../types';
import { copyImageToClipboard } from '../utils/historyStorage';
import { playCopySound, playTrashSound } from '../utils/soundEffects';
import { toast } from 'sonner';
import { validateVehicleData } from '../utils/validation';

interface ServiceHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ServiceHistoryItem[];
  onSelectService: (item: ServiceHistoryItem) => void;
  onDeleteService: (id: string) => void;
  onClearHistory: () => void;
}

export const ServiceHistoryDrawer: React.FC<ServiceHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectService,
  onDeleteService,
  onClearHistory,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);

  // Fechar com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtragem de busca
  const filteredHistory = history.filter((item) => {
    const term = searchTerm.toLowerCase();
    const placa = (item.vehicleData.placa || '').toLowerCase();
    const prop = (item.vehicleData.proprietario || '').toLowerCase();
    const mod = (item.vehicleData.modelo || '').toLowerCase();
    const serv = (item.vehicleData.servico || '').toLowerCase();
    return (
      placa.includes(term) ||
      prop.includes(term) ||
      mod.includes(term) ||
      serv.includes(term)
    );
  });

  const handleCopyText = async (item: ServiceHistoryItem) => {
    const validation = validateVehicleData(item.vehicleData);
    if (!validation.isValid) {
      toast.error('Este serviço possui campos incompletos!', {
        description: `Campos não identificados: ${validation.missingFields.join(', ')}. Abra o serviço no painel para preencher.`,
        duration: 3500,
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(item.formattedText);
      playCopySound();
      setCopiedTextId(item.id);
      toast.success('Texto do histórico copiado!', {
        description: `${item.vehicleData.modelo} • ${item.vehicleData.placa}`,
        duration: 1800,
      });
      setTimeout(() => setCopiedTextId(null), 1800);
    } catch (_) {}
  };

  const handleCopyImage = async (item: ServiceHistoryItem) => {
    const targetUrl = item.discordImageUrl || item.thumbnailUrl;
    if (!targetUrl) return;

    toast.loading('Copiando foto em alta resolução...', { id: `copy-img-${item.id}` });
    const success = await copyImageToClipboard(targetUrl);
    toast.dismiss(`copy-img-${item.id}`);

    if (success) {
      playCopySound();
      setCopiedImageId(item.id);
      toast.success('Foto copiada para o clipboard!', {
        description: 'Você pode colar a imagem com Ctrl+V.',
        duration: 2000,
      });
      setTimeout(() => setCopiedImageId(null), 1800);
    } else {
      toast.error('Erro ao copiar imagem para o clipboard');
    }
  };

  const handleDeleteWithSound = (id: string) => {
    playTrashSound();
    onDeleteService(id);
    toast('Serviço removido do histórico');
  };

  const handleClearWithSound = () => {
    playTrashSound();
    onClearHistory();
    toast('Histórico de 24h limpo');
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Agora mesmo';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-end transition-all duration-300 ${
        isOpen
          ? 'opacity-100 pointer-events-auto visible'
          : 'opacity-0 pointer-events-none invisible'
      }`}
    >
      {/* Backdrop com desfoque e fade */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer Lateral com animação ultra-fluida de Slide */}
      <div
        className={`relative w-full max-w-lg h-full bg-[#111827] border-l border-[#1f2937] flex flex-col z-10 shadow-2xl transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Cabeçalho */}
        <div className="bg-[#0f172a] border-b border-[#1f2937] px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center">
              <History className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Últimos Serviços
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800/60 font-mono">
                  {history.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Salvos localmente no seu navegador por 24 horas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Deseja limpar todo o histórico de serviços?')) {
                    handleClearWithSound();
                  }
                }}
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-900/40 transition-colors active:scale-95 cursor-pointer"
                title="Limpar todos os registros"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        {history.length > 0 && (
          <div className="p-3.5 border-b border-[#1f2937] bg-[#0c111d] shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por veículo, placa ou proprietário..."
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-blue-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Lista de Registros com Scroll Suave */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Clock className="w-12 h-12 mb-3 text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-300">
                Nenhum serviço registrado ainda
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Ao colar ou processar um print de veículo, ele aparecerá aqui automaticamente durante 24h.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Nenhum serviço encontrado para "{searchTerm}".
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isTextCopied = copiedTextId === item.id;
              const isImgCopied = copiedImageId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-[#0f172a] border border-[#1f2937] hover:border-slate-700 rounded-xl p-3.5 space-y-3 transition-all duration-150 hover:bg-[#121c33]"
                >
                  {/* Topo do Card: Carro + Horário */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-amber-400 shrink-0" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        {item.vehicleData.modelo || 'Veículo'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Detalhes: Placa, Proprietário e Thumbnail */}
                  <div className="flex items-center gap-3">
                    {item.thumbnailUrl ? (
                      <div className="w-20 h-14 bg-[#090d16] rounded-lg overflow-hidden border border-[#1f2937] shrink-0 flex items-center justify-center">
                        <img
                          src={item.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-14 bg-[#090d16] rounded-lg border border-[#1f2937] shrink-0 flex items-center justify-center text-slate-600">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1 text-xs">
                      {/* Placa */}
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Tag className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="font-mono font-semibold text-blue-400">
                          {item.vehicleData.placa || 'Sem placa'}
                        </span>
                      </div>

                      {/* Proprietário */}
                      <div className="flex items-center gap-1.5 text-slate-300 truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {item.vehicleData.proprietario || 'Não informado'}
                        </span>
                      </div>

                      {/* Serviço */}
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                        <Wrench className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {item.vehicleData.servico || 'Troca de óleo e filtro'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[#1f2937]/70">
                    {/* Botão Copiar Texto */}
                    <button
                      type="button"
                      onClick={() => handleCopyText(item)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                        isTextCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155]'
                      }`}
                      title="Copiar texto formatado do veículo"
                    >
                      {isTextCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Texto Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-blue-400" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    {/* Botão Copiar Imagem */}
                    {item.thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyImage(item)}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                          isImgCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155]'
                        }`}
                        title="Copiar imagem para colar no Discord / WhatsApp"
                      >
                        {isImgCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Copiada!</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>Copiar Foto</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Botão Carregar no Painel */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectService(item);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white border border-[#334155] transition-all active:scale-95 cursor-pointer"
                      title="Abrir e carregar este veículo no painel principal"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {/* Botão Excluir Item */}
                    <button
                      type="button"
                      onClick={() => handleDeleteWithSound(item.id)}
                      className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 hover:text-rose-200 border border-rose-900/40 transition-all active:scale-95 cursor-pointer"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
