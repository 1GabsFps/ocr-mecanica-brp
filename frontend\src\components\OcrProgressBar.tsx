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
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-3.5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          )}

          <span className="text-xs font-medium text-slate-200">
            {progress.status || 'Processando imagem...'}
          </span>
        </div>

        <span className="text-xs font-mono font-medium text-blue-400">
          {Math.min(100, Math.max(0, progress.progress))}%
        </span>
      </div>

      {/* Barra de Progresso */}
      <div className="w-full bg-[#0a0f1d] rounded-full h-1.5 overflow-hidden border border-[#1f2937]">
        <div
          className={`h-full transition-all duration-200 ease-out rounded-full ${
            isError ? 'bg-rose-500' : isComplete ? 'bg-emerald-500' : 'bg-blue-600'
          }`}
          style={{ width: `${Math.max(4, Math.min(100, progress.progress))}%` }}
        />
      </div>
    </div>
  );
};
