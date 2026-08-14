import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileText } from 'lucide-react';
interface RawTextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
}

export const RawTextDrawer: React.FC<RawTextDrawerProps> = ({
  isOpen,
  onClose,
  rawText,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        isOpen
          ? 'opacity-100 pointer-events-auto visible'
          : 'opacity-0 pointer-events-none invisible'
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Caixa de Diálogo */}
      <div
        className={`relative bg-[#111827] border border-[#1f2937] w-full max-w-2xl rounded-xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl transition-all duration-200 transform ${
          isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0'
        }`}
      >
        {/* Cabeçalho do Modal */}
        <div className="bg-[#0f172a] border-b border-[#1f2937] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Texto Bruto Reconhecido
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Palavras lidas diretamente da imagem:
            </span>
            <button
              onClick={handleCopyRaw}
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-800/50 cursor-pointer transition-all active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="p-3 bg-[#0a0f1d] border border-[#1f2937] rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
            {rawText || 'Nenhum texto reconhecido.'}
          </pre>
        </div>
      </div>
    </div>
  );
};
