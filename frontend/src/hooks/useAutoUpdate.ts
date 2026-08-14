import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

let globalCachedServerVersion: number | null = null;

export async function checkServerVersion(): Promise<{ isOutdated: boolean; serverVersion: number | null }> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0' },
    });

    if (!res.ok) return { isOutdated: false, serverVersion: null };

    const data = await res.json();
    const serverVersion = data.version;

    if (globalCachedServerVersion === null) {
      globalCachedServerVersion = serverVersion;
      return { isOutdated: false, serverVersion };
    }

    if (serverVersion && serverVersion !== globalCachedServerVersion) {
      return { isOutdated: true, serverVersion };
    }

    return { isOutdated: false, serverVersion };
  } catch (_) {
    return { isOutdated: false, serverVersion: null };
  }
}

/**
 * Hook que monitora novas versões no servidor de forma não-destrutiva quando o operador está digitando.
 */
export function useAutoUpdate() {
  const isUpdatingRef = useRef<boolean>(false);
  const isCheckingRef = useRef<boolean>(false);
  const checkDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkVersion() {
      if (isUpdatingRef.current || isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const { isOutdated } = await checkServerVersion();

        if (isOutdated && !isUpdatingRef.current && isMounted) {
          // Verifica se o usuário está com foco em algum input ou textarea
          const activeEl = document.activeElement;
          const isUserTyping =
            activeEl &&
            (activeEl.tagName === 'INPUT' ||
              activeEl.tagName === 'TEXTAREA' ||
              (activeEl as HTMLElement).isContentEditable);

          if (isUserTyping) {
            // Notificação persistente não-destrutiva com botão de ação
            toast.info('🚀 Nova atualização disponível!', {
              id: 'auto-update-system-toast',
              description: 'Uma nova versão do sistema está pronta para carregar.',
              duration: Infinity,
              action: {
                label: 'Atualizar Agora',
                onClick: () => window.location.reload(),
              },
            });
          } else {
            isUpdatingRef.current = true;
            toast.info('🚀 Atualizando sistema...', {
              id: 'auto-update-system-toast',
              description: 'Carregando nova versão...',
              duration: 2000,
            });
            setTimeout(() => {
              if (isMounted) {
                window.location.reload();
              }
            }, 1000);
          }
        }
      } catch (_) {
      } finally {
        isCheckingRef.current = false;
      }
    }

    // Checagem inicial ao carregar a página
    checkVersion();

    // Checagem periódica a cada 30 segundos
    const interval = setInterval(checkVersion, 30 * 1000);

    // Checagem imediata ao alternar janelas (Alt+Tab) com debounce
    const triggerDebouncedCheck = () => {
      if (checkDebounceTimerRef.current) {
        clearTimeout(checkDebounceTimerRef.current);
      }
      checkDebounceTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          checkVersion();
        }
      }, 100);
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

