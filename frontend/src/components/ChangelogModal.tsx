import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  Rocket,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { CHANGELOG_DATA, CURRENT_APP_VERSION, ChangelogItem } from '../data/changelog';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDismiss = () => {
    localStorage.setItem('mec_last_seen_version', CURRENT_APP_VERSION);
    onClose();
  };

  if (!isOpen) return null;

  const renderBadge = (type: ChangelogItem['type']) => {
    switch (type) {
      case 'feature':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase">
            Novo
          </span>
        );
      case 'performance':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-950/80 text-amber-400 border border-amber-800/60 uppercase flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            Velocidade
          </span>
        );
      case 'improvement':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-950/80 text-blue-400 border border-blue-800/60 uppercase">
            Melhoria
          </span>
        );
      case 'fix':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-950/80 text-purple-400 border border-purple-800/60 uppercase">
            Ajuste
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Caixa Flutuante do Changelog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
        className="relative bg-[#0c1220] border border-[#1e293b] w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl z-10 max-h-[85vh] flex flex-col"
      >
        {/* Glow de Fundo */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-blue-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Cabeçalho */}
        <div className="bg-[#080d1a] border-b border-[#1e293b] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center shadow-md shadow-blue-900/30">
              <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  O que há de novo
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-blue-600 text-white shadow-sm">
                  v{CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Atualizações e melhorias recentes no leitor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo com Linha do Tempo e Scroll */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {CHANGELOG_DATA.map((release, releaseIdx) => (
            <div key={release.version} className="space-y-3">
              {/* Título da Versão */}
              <div className="flex items-center justify-between pb-1 border-b border-[#1e293b]/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black font-mono text-white">
                    Versão {release.version}
                  </span>
                  {release.tag === 'Atual' && (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold font-mono bg-blue-950 text-blue-300 border border-blue-800/60">
                      Último Lançamento
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {release.date}
                </span>
              </div>

              {/* Itens da Versão */}
              <div className="space-y-2.5">
                {release.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-3.5 space-y-1 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{item.title}</span>
                      </h4>
                      {renderBadge(item.type)}
                    </div>
                    <p className="text-[11px] text-slate-400 pl-5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé com Botão Entendi */}
        <div className="bg-[#080d1a] border-t border-[#1e293b] px-5 py-3.5 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Rocket className="w-3 h-3 text-emerald-400" />
            Mecânica BRP v{CURRENT_APP_VERSION}
          </span>

          <button
            type="button"
            onClick={handleDismiss}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-900/30 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Entendi, vamos lá!</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
