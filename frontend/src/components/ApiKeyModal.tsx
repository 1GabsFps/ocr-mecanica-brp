import React, { useState, useEffect } from 'react';
import { X, Key, Check, ShieldCheck, Lock, RotateCcw, Info, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userKey: string;
  hasEnvKey: boolean;
  onSaveUserKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  userKey,
  hasEnvKey,
  onSaveUserKey,
}) => {
  const [inputKey, setInputKey] = useState<string>('');
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    setInputKey(userKey || '');
  }, [userKey, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveUserKey(inputKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  const handleClearCustomKey = () => {
    setInputKey('');
    onSaveUserKey('');
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
        className={`relative bg-[#111827] border border-[#1f2937] w-full max-w-md rounded-xl overflow-hidden flex flex-col shadow-2xl transition-all duration-200 transform ${
          isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0'
        }`}
      >
        {/* Cabeçalho */}
        <div className="bg-[#0f172a] border-b border-[#1f2937] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Chave de API (Google AI Studio)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSave} className="p-4 space-y-3.5">
          {/* Status Atual da Chave */}
          {userKey ? (
            <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/50 flex items-start gap-2">
              <Key className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-300">
                  Chave Personalizada Ativa
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Suas requisições estão usando a chave própria salva no localStorage.
                </p>
              </div>
            </div>
          ) : hasEnvKey ? (
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-start gap-2">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-300">
                  Chave do Sistema Ativa
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  A plataforma já está operando com IA. Se quiser, insira uma chave própria abaixo.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400">
                Nenhuma chave configurada. O sistema está usando o <strong>OCR Local</strong>.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              {hasEnvKey && !userKey ? 'Substituir por Minha Própria Chave' : 'Sua Chave de API'}
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Cole sua chave AIzaSy..."
              className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Sua chave pessoal fica armazenada <strong>apenas no seu navegador</strong> (localStorage).
            </p>
          </div>

          {/* Dica */}
          <div className="p-2.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Como obter chave no Google AI Studio?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              No Google AI Studio, crie uma chave em um projeto novo gratuito.
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline font-medium"
            >
              <span>Abrir Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between gap-3 pt-1">
            {userKey ? (
              <button
                type="button"
                onClick={handleClearCustomKey}
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{hasEnvKey ? 'Restaurar Chave Padrão' : 'Remover Minha Chave'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all active:scale-95 cursor-pointer"
              >
                {saved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvo!</span>
                  </>
                ) : (
                  <span>Salvar Chave</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
