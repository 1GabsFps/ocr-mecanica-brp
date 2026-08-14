import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Hook que monitora novas versões no servidor e força a atualização automática sem toasts duplicados.
 */
export function useAutoUpdate() {
  const initialVersionRef = useRef<number | null>(null);
  const isUpdatingRef = useRef<boolean>(false);
  const isCheckingRef = useRef<boolean>(false);
  const checkDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkVersion() {
      if (isUpdatingRef.current || isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        });

        if (!res.ok) return;

        const data = await res.json();
        const serverVersion = data.version;

        if (initialVersionRef.current === null) {
          initialVersionRef.current = serverVersion;
          return;
        }

        if (serverVersion && serverVersion !== initialVersionRef.current) {
          isUpdatingRef.current = true;

          // ID único impede que o Sonner gere notificações duplicadas na tela
          toast.info('🚀 Nova atualização do sistema disponível!', {
            id: 'auto-update-system-toast',
            description: 'Recarregando automaticamente para aplicar as novidades...',
            duration: 3500,
            action: {
              label: 'Atualizar Agora',
              onClick: () => window.location.reload(),
            },
          });

          // Recarrega automaticamente após 2.5 segundos
          setTimeout(() => {
            if (isMounted) {
              window.location.reload();
            }
          }, 2500);
        }
      } catch (_) {
      } finally {
        isCheckingRef.current = false;
      }
    }

    // Checagem inicial ao carregar a página
    checkVersion();

    // Checagem periódica a cada 45 segundos
    const interval = setInterval(checkVersion, 45 * 1000);

    // Checagem com debounce ao alternar janelas (evita duplo disparo de focus + visibilitychange)
    const triggerDebouncedCheck = () => {
      if (checkDebounceTimerRef.current) {
        clearTimeout(checkDebounceTimerRef.current);
      }
      checkDebounceTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          checkVersion();
        }
      }, 150);
    };

    document.addEventListener('visibilitychange', triggerDebouncedCheck);
    window.addEventListener('focus', triggerDebouncedCheck);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (checkDebounceTimerRef.current) {
        clearTimeout(checkDebounceTimerRef.current);
      }
      document.removeEventListener('visibilitychange', triggerDebouncedCheck);
      window.removeEventListener('focus', triggerDebouncedCheck);
    };
  }, []);
}
