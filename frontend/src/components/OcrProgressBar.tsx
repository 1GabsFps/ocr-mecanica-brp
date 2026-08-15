import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Zap, RefreshCw, Cloud } from 'lucide-react';
import { OcrProgress } from '../types';

interface OcrProgressBarProps {
  progress: OcrProgress;
  isProcessing: boolean;
}

export const OcrProgressBar: React.FC<OcrProgressBarProps> = ({ progress, isProcessing }) => {
  if (!isProcessing && progress.stage === 'idle') {
    return null;
  }

  const isComplete = progress.stage === 'complete' || progress.progress === 100;
  const isError = progress.stage === 'error';
  const badgeType = progress.badgeType || 'default';

  // Cores do Badge Dinâmico
  const getBadgeStyle = () => {
    switch (badgeType) {
      case 'hedge':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'switch':
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      case 'cloudflare':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'success':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'error':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
  };

  // Ícone de Status Dinâmico
  const renderIcon = () => {
    if (isError) {
      return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
    }
    if (isComplete) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (badgeType === 'hedge') {
      return <Zap className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />;
    }
    if (badgeType === 'switch') {
      return <RefreshCw className="w-4 h-4 text-orange-400 animate-spin shrink-0" />;
    }
    if (badgeType === 'cloudflare') {
      return <Cloud className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />;
    }
    return <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
  };

  // Cor da Barra
  const getBarColor = () => {
    if (isError) return 'bg-rose-500';
    if (isComplete) return 'bg-emerald-500';
    if (badgeType === 'hedge') return 'bg-gradient-to-r from-blue-500 to-amber-500';
    if (badgeType === 'switch') return 'bg-gradient-to-r from-blue-500 to-orange-500';
    if (badgeType === 'cloudflare') return 'bg-gradient-to-r from-purple-500 to-indigo-500';
    return 'bg-blue-600';
  };

  return (
    <div className="bg-[#0c1220]/95 border border-[#1e293b] rounded-xl p-3.5 mb-6 shadow-lg backdrop-blur-sm transition-all duration-300">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {renderIcon()}

          <span className="text-xs font-medium text-slate-200 truncate">
            {progress.status || 'Processando imagem...'}
          </span>

          {/* Badge Informativo de Etapa / Chave */}
          {progress.badge && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold tracking-wide shrink-0 transition-colors ${getBadgeStyle()}`}
            >
              {progress.badge}
            </span>
          )}
        </div>

        <span className="text-xs font-mono font-bold text-blue-400 tabular-nums shrink-0">
          {Math.min(100, Math.max(0, progress.progress))}%
        </span>
      </div>

      {/* Barra de Progresso Suave */}
      <div className="w-full bg-[#080d1a] rounded-full h-1.5 overflow-hidden border border-[#1e293b]">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${getBarColor()}`}
          style={{ width: `${Math.max(4, Math.min(100, progress.progress))}%` }}
        />
      </div>
    </div>
  );
};
