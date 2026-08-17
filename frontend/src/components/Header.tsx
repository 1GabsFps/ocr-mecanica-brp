import React from 'react';
import { Wrench, RefreshCw, Settings, History, LogOut, UserCheck } from 'lucide-react';
import { MechanicUser } from '../services/authService';

interface HeaderProps {
  onReset: () => void;
  hasImage: boolean;
  onOpenSettings: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  autoCopy: boolean;
  autoPaste: boolean;
  user?: MechanicUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  hasImage,
  onOpenSettings,
  historyCount,
  onOpenHistory,
  autoCopy,
  autoPaste,
  user,
  onLogout,
}) => {
  return (
    <header className="bg-[#0b0f19]/85 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-40 shrink-0 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Logo e Título */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-400/30">
            <Wrench className="w-4 h-4 text-white" />
          </div>

          <div>
            <h1 className="text-base font-bold tracking-tight text-white uppercase font-sans flex items-center gap-1.5">
              <span>Leitor Mecânica</span>
              <span className="text-blue-500 font-extrabold drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">BRP</span>
            </h1>
          </div>
        </div>

        {/* Ações do Header (Sleek Ghost Glassmorphic Buttons + User Profile) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Perfil do Mecânico Logado */}
          {user && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-blue-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] mr-1">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.nome}
                  className="w-5 h-5 rounded-full ring-1 ring-blue-400/50 object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-950 border border-blue-500/40 flex items-center justify-center">
                  <UserCheck className="w-3 h-3 text-blue-400" />
                </div>
              )}
              <span className="text-xs font-semibold text-slate-200 max-w-[110px] sm:max-w-[150px] truncate" title={user.nome}>
                {user.nome}
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-rose-400 transition-colors p-0.5 ml-0.5 rounded hover:bg-rose-950/40 cursor-pointer"
                  title="Encerrar sessão Steam"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Botão 1: Histórico de Serviços */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-800/70 text-slate-300 hover:text-white border border-white/10 hover:border-blue-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-all duration-200 active:scale-95 cursor-pointer group"
            title="Ver histórico dos últimos serviços (24h)"
          >
            <History className="w-3.5 h-3.5 text-blue-400 transition-transform group-hover:rotate-[-15deg]" />
            <span className="hidden sm:inline">Últimos Serviços</span>
            {historyCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/80 text-white font-mono border border-blue-400/30">
                {historyCount}
              </span>
            )}
          </button>

          {/* Botão 2: Configurações */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-800/70 text-slate-300 hover:text-white border border-white/10 hover:border-blue-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-all duration-200 active:scale-95 cursor-pointer relative group"
            title="Abrir Configurações (Auto-Copiar, Auto-Colar e Chave de API)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-300 transition-transform group-hover:rotate-45" />
            <span className="hidden sm:inline">Configurações</span>

            {/* Indicador de automações ativas */}
            {(autoCopy || autoPaste) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" title="Automações ativas" />
            )}
          </button>

          {/* Botão 3: Limpar Painel (Ghost com sutil acento vermelho) */}
          {hasImage && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-950/20 hover:bg-rose-900/40 text-rose-300/90 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/60 shadow-[inset_0_1px_0_rgba(244,63,94,0.15)] backdrop-blur-md transition-all duration-200 active:scale-95 cursor-pointer group"
              title="Limpar imagem e campos"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400 transition-transform group-hover:rotate-180 duration-300" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
