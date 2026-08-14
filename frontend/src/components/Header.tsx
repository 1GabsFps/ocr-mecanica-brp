import React from 'react';
import { Wrench, RefreshCw, Settings, History } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  hasImage: boolean;
  onOpenSettings: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  autoCopy: boolean;
  autoPaste: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  hasImage,
  onOpenSettings,
  historyCount,
  onOpenHistory,
  autoCopy,
  autoPaste,
}) => {
  return (
    <header className="bg-[#111827] border-b border-[#1f2937] sticky top-0 z-40 shrink-0 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Logo e Título */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-900/30">
            <Wrench className="w-4 h-4 text-white" />
          </div>

          <div>
            <h1 className="text-base font-bold tracking-tight text-white uppercase font-sans flex items-center gap-1.5">
              <span>Leitor Mecânica</span>
              <span className="text-blue-500 font-extrabold">BRP</span>
            </h1>
          </div>
        </div>

        {/* Ações do Header */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Botão de Histórico de Serviços */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Ver histórico dos últimos serviços (24h)"
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Últimos Serviços</span>
            {historyCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white font-mono">
                {historyCount}
              </span>
            )}
          </button>

          {/* Botão de Configurações (Abre o Modal Flutuante com Auto-Copiar, Auto-Colar e Chave) */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] hover:border-slate-500 transition-all active:scale-95 cursor-pointer shadow-sm relative"
            title="Abrir Configurações (Auto-Copiar, Auto-Colar e Chave de API)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Configurações</span>

            {/* Indicador de automações ativas */}
            {(autoCopy || autoPaste) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Automações ativas" />
            )}
          </button>

          {/* Botão de Limpar Painel */}
          {hasImage && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Limpar imagem e campos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
