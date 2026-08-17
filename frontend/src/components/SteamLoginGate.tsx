import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Wrench, Lock, Zap, Award, Sparkles } from 'lucide-react';

interface SteamLoginGateProps {
  onLogin: () => void;
  authError?: string | null;
  isLoading?: boolean;
}

export const SteamLoginGate: React.FC<SteamLoginGateProps> = ({
  onLogin,
  authError,
  isLoading = false,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto my-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative bg-[#090d16]/90 border border-slate-800/80 rounded-2xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center overflow-hidden"
      >
        {/* Glow Superior */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Emblema da Mecânica */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-900 border border-blue-400/30 flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(37,99,235,0.35)]">
          <Wrench className="w-8 h-8 text-white drop-shadow" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
          </div>
        </div>

        {/* Título & Descrição */}
        <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-2">
          Mecânica BRP • Acesso Restrito
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
          O leitor OCR inteligente é exclusivo para os membros autorizados da oficina. Faça login com a sua conta Steam para liberar a ferramenta.
        </p>

        {/* Alerta de Erro de Autorização */}
        {authError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-3 text-left"
          >
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="leading-tight">
              <span className="font-bold block text-rose-200">Acesso Não Autorizado</span>
              <span>{authError}</span>
            </div>
          </motion.div>
        )}

        {/* Botão Oficial de Login com a Steam */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={onLogin}
            disabled={isLoading}
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-[#171a21] hover:bg-[#222834] border border-[#2a475e] text-white font-bold text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(102,192,244,0.35)] cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {/* Ícone da Steam SVG Oficial */}
            <svg
              className="w-6 h-6 fill-current text-[#66c0f4] group-hover:scale-110 transition-transform"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.636 7.855 6.356 9.312l2.673-3.692a3.486 3.486 0 0 1-.029-.444c0-.147.014-.291.036-.432L7.382 14.54a4.498 4.498 0 0 1-.382-1.815c0-2.485 2.015-4.5 4.5-4.5 2.485 0 4.5 2.015 4.5 4.5 0 2.485-2.015 4.5-4.5 4.5-.164 0-.325-.01-.484-.029l-3.69 2.672C8.75 21.905 10.334 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 6c1.933 0 3.5 1.567 3.5 3.5S13.933 15 12 15s-3.5-1.567-3.5-3.5S10.067 8 12 8z" />
            </svg>
            <span>{isLoading ? 'Conectando à Steam...' : 'Entrar com a Steam'}</span>
          </button>
        </div>

        {/* Badges de Benefícios */}
        <div className="mt-8 pt-6 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-[10px] sm:text-xs text-slate-400 font-mono">
          <div className="flex flex-col items-center gap-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>OCR em ~1.4s</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Award className="w-4 h-4 text-blue-400" />
            <span>Ranking Diário</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Sync Discord</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
