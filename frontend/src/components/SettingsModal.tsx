import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Check,
  Copy,
  ClipboardPaste,
  Sparkles,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { playToggleSound } from '../utils/soundEffects';
import { CURRENT_APP_VERSION } from '../data/changelog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoCopy: boolean;
  onToggleAutoCopy: () => void;
  autoPaste: boolean;
  onToggleAutoPaste: () => void;
  userKey: string;
  hasEnvKey: boolean;
  onSaveUserKey: (key: string) => void;
  onOpenChangelog?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  autoCopy,
  onToggleAutoCopy,
  autoPaste,
  onToggleAutoPaste,
  userKey,
  hasEnvKey,
  onSaveUserKey,
  onOpenChangelog,
}) => {
  const [inputKey, setInputKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState<boolean>(false);

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

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveUserKey(inputKey.trim());
    setSavedKeySuccess(true);
    toast.success(inputKey.trim() ? 'Chave de API salva com sucesso!' : 'Usando chave padrão da oficina');
    setTimeout(() => {
      setSavedKeySuccess(false);
    }, 1500);
  };

  const handleClearCustomKey = () => {
    setInputKey('');
    onSaveUserKey('');
    toast('Chave personalizada removida. Usando servidor.');
  };

  const handleTestClipboardPermission = async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast.error('Seu navegador não suporta leitura direta de clipboard.');
      return;
    }

    try {
      await navigator.clipboard.read();
      toast.success('Permissão de leitura do Clipboard concedida!', {
        description: 'O Auto-Colar ao dar Alt+Tab funcionará automaticamente.',
      });
    } catch (err: any) {
      toast.warning('Permissão necessária', {
        description: 'Clique em "Permitir" quando o navegador perguntar para ativar o Auto-Colar.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop com Blur Escuro */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Caixa Flutuante no Centro da Tela */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
        className="relative bg-[#0c1220] border border-[#1e293b] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl z-10 max-h-[90vh] flex flex-col"
      >
        {/* Glow de Fundo */}
        <div className="absolute top-0 right-0 w-48 h-24 bg-blue-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Cabeçalho */}
        <div className="bg-[#080d1a] border-b border-[#1e293b] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center">
              <Settings className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Configurações & Automações
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Preferências salvas no seu navegador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 1. Opção: Auto-Copiar */}
          <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-950/80 border border-amber-800/50 flex items-center justify-center shrink-0 mt-0.5">
                <Copy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Auto-Copiar Ficha
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      autoCopy ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-slate-900 text-slate-500'
                    }`}
                  >
                    {autoCopy ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Copia os dados formatados automaticamente para o clipboard assim que a IA validar a ficha.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => {
                playToggleSound(!autoCopy);
                onToggleAutoCopy();
              }}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer shrink-0 border ${
                autoCopy
                  ? 'bg-amber-600 border-amber-500 justify-end'
                  : 'bg-[#151e2e] border-[#24334a] justify-start'
              } flex items-center`}
            >
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* 2. Opção: Auto-Colar (Alt+Tab / Foco) */}
          <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-800/50 flex items-center justify-center shrink-0 mt-0.5">
                <ClipboardPaste className="w-4 h-4 text-blue-400" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Auto-Colar no Alt+Tab
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      autoPaste ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-slate-900 text-slate-500'
                    }`}
                  >
                    {autoPaste ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Ao alternar para a aba do site após tirar um print, detecta a foto e inicia o OCR sem precisar dar Ctrl+V.
                </p>
                {autoPaste && (
                  <button
                    type="button"
                    onClick={handleTestClipboardPermission}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline font-mono block pt-1 cursor-pointer"
                  >
                    Testar / Conceder Permissão do Navegador
                  </button>
                )}
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => {
                playToggleSound(!autoPaste);
                onToggleAutoPaste();
                if (!autoPaste) {
                  handleTestClipboardPermission();
                }
              }}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer shrink-0 border ${
                autoPaste
                  ? 'bg-blue-600 border-blue-500 justify-end'
                  : 'bg-[#151e2e] border-[#24334a] justify-start'
              } flex items-center`}
            >
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* 3. Seção: Novidades & Changelog */}
          <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-4 flex items-center justify-between gap-4 hover:border-blue-900/60 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-800/50 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Novidades & Atualizações
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                    v{CURRENT_APP_VERSION}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Consulte a linha do tempo com todas as novidades lançadas no sistema.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChangelog?.();
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] transition-all active:scale-95 cursor-pointer shrink-0"
            >
              Ver Novidades
            </button>
          </div>

          {/* 4. Seção: Chave de API Própria */}
          <div className="bg-[#080d1a] border border-[#1e293b] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Chave Gemini Própria (Opcional)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {userKey ? 'Personalizada' : hasEnvKey ? 'Oficina (Servidor)' : 'Não Configurada'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              O site já possui chaves ativas no servidor. Se quiser usar uma chave particular do Google AI Studio para sua máquina, cole abaixo.
            </p>

            <form onSubmit={handleSaveKey} className="space-y-2.5">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder={hasEnvKey ? 'Usando chave padrão da oficina (Deixe em branco)' : 'Cole sua chave AIzaSy...'}
                  className="w-full bg-[#040711] border border-[#1e293b] focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2 justify-end">
                {userKey && (
                  <button
                    type="button"
                    onClick={handleClearCustomKey}
                    className="px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all cursor-pointer font-medium"
                  >
                    Usar Padrão da Oficina
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-950/50"
                >
                  {savedKeySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvo!</span>
                    </>
                  ) : (
                    <span>Salvar Chave</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-[#080d1a] border-t border-[#1e293b] px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-400" />
            Configurações salvas permanentemente
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] transition-all active:scale-95 cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </motion.div>
    </div>
  );
};
