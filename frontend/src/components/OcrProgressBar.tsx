import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

  return (
    <div className="bg-[#0c1220]/95 border border-[#1e293b] rounded-xl p-3.5 mb-6 shadow-lg backdrop-blur-sm transition-all duration-300">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
          )}

          <span className="text-xs font-medium text-slate-200 truncate">
            {progress.status || 'Processando imagem...'}
          </span>
        </div>

        <span className="text-xs font-mono font-bold text-blue-400 tabular-nums shrink-0">
          {Math.min(100, Math.max(0, progress.progress))}%
        </span>
      </div>

      {/* Barra de Progresso Suave */}
      <div className="w-full bg-[#080d1a] rounded-full h-1.5 overflow-hidden border border-[#1e293b]">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${
            isError ? 'bg-rose-500' : isComplete ? 'bg-emerald-500' : 'bg-blue-600'
          }`}
          style={{ width: `${Math.max(4, Math.min(100, progress.progress))}%` }}
        />
      </div>
    </div>
  );
};
