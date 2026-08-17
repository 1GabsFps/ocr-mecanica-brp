import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export type ServiceMode = 'oleo' | 'tuning' | 'retifica' | 'extra';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  hasImage: boolean;
  onSwitchServiceMode: (mode: ServiceMode) => void;
  onCopyFormattedText: () => void;
  onReset: () => void;
  onToggleHistory: () => void;
  onToggleSettings: () => void;
  onOpenAdmin: () => void;
}

/**
 * Hook para gerenciamento de Atalhos Globais de Teclado (Power User Mode)
 * com trava inteligente quando o operador estiver com foco em inputs de texto.
 */
export function useKeyboardShortcuts({
  enabled,
  hasImage,
  onSwitchServiceMode,
  onCopyFormattedText,
  onReset,
  onToggleHistory,
  onToggleSettings,
  onOpenAdmin,
}: UseKeyboardShortcutsOptions) {
  const optionsRef = useRef({
    enabled,
    hasImage,
    onSwitchServiceMode,
    onCopyFormattedText,
    onReset,
    onToggleHistory,
    onToggleSettings,
    onOpenAdmin,
  });

  useEffect(() => {
    optionsRef.current = {
      enabled,
      hasImage,
      onSwitchServiceMode,
      onCopyFormattedText,
      onReset,
      onToggleHistory,
      onToggleSettings,
      onOpenAdmin,
    };
  }, [
    enabled,
    hasImage,
    onSwitchServiceMode,
    onCopyFormattedText,
    onReset,
    onToggleHistory,
    onToggleSettings,
    onOpenAdmin,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const opts = optionsRef.current;

      // Atalho Secreto do Painel Admin (Ctrl + Shift + A) funciona sempre
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
        e.preventDefault();
        opts.onOpenAdmin?.();
        return;
      }

      // Se atalhos estiverem desativados nas configurações, encerra
      if (!opts.enabled) return;

      // Ignora atalhos de tecla única se o usuário estiver digitando em campo de formulário
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isTyping) {
        // Permite apenas Esc para tirar o foco do input
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Ignora se estiver segurando Ctrl/Alt/Meta exceto quando previsto
      const isAlt = e.altKey;
      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && !e.shiftKey) {
        return; // Deixa o navegador lidar com Ctrl+C, Ctrl+V, Ctrl+R
      }

      // 1. Alternância de Abas de Serviço (1..4 ou Alt+1..4)
      if (e.key === '1' || (isAlt && e.key === '1')) {
        e.preventDefault();
        opts.onSwitchServiceMode('oleo');
        return;
      }
      if (e.key === '2' || (isAlt && e.key === '2')) {
        e.preventDefault();
        opts.onSwitchServiceMode('tuning');
        return;
      }
      if (e.key === '3' || (isAlt && e.key === '3')) {
        e.preventDefault();
        opts.onSwitchServiceMode('retifica');
        return;
      }
      if (e.key === '4' || (isAlt && e.key === '4')) {
        e.preventDefault();
        opts.onSwitchServiceMode('extra');
        return;
      }

      // 2. Copiar Ficha Formatada (Enter ou Espaço quando houver imagem)
      if (e.key === 'Enter') {
        if (opts.hasImage) {
          e.preventDefault();
          opts.onCopyFormattedText();
        }
        return;
      }

      // 3. Reset / Limpar Tela (Escape)
      if (e.key === 'Escape') {
        if (opts.hasImage) {
          e.preventDefault();
          opts.onReset();
          toast('Ficha limpa pelo atalho (Esc)');
        }
        return;
      }

      // 4. Histórico (Tecla H)
      if ((e.key === 'h' || e.key === 'H') && !isAlt && !isCtrl) {
        e.preventDefault();
        opts.onToggleHistory();
        return;
      }

      // 5. Configurações (Tecla S)
      if ((e.key === 's' || e.key === 'S') && !isAlt && !isCtrl) {
        e.preventDefault();
        opts.onToggleSettings();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
