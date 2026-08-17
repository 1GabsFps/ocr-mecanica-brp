export interface MechanicUser {
  steamHex: string;
  nome: string;
  avatarUrl: string;
  expiresAt?: number;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user?: MechanicUser;
}

const SESSION_TOKEN_KEY = 'mec_session_token';
const USER_CACHE_KEY = 'mec_user_profile';

export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function getStoredUserProfile(): MechanicUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveSession(token: string, user: MechanicUser) {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
}

/**
 * Captura e processa parâmetros de autenticação retornados da Steam na URL hash (#token=...&nome=...)
 */
export function extractAuthFromUrl(): { token: string; user: MechanicUser } | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash || !hash.includes('token=')) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token');
  const nome = params.get('nome');
  const steamHex = params.get('steamHex');
  const avatar = params.get('avatar');

  if (token && steamHex && nome) {
    const user: MechanicUser = {
      steamHex: decodeURIComponent(steamHex),
      nome: decodeURIComponent(nome),
      avatarUrl: decodeURIComponent(avatar || ''),
    };

    saveSession(token, user);

    // Limpa a URL hash para manter visual limpo
    history.replaceState(null, '', window.location.pathname);

    return { token, user };
  }

  return null;
}

export function getAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes('auth_error=')) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const error = params.get('auth_error');

  // Limpa a URL
  history.replaceState(null, '', window.location.pathname);
  return error;
}

/**
 * Valida a sessão atual com o backend na VPS
 */
export async function checkAuthStatus(): Promise<MechanicUser | null> {
  const token = getStoredSessionToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data: AuthMeResponse = await res.json();
    if (data.authenticated && data.user) {
      saveSession(token, data.user);
      return data.user;
    } else {
      clearSession();
      return null;
    }
  } catch (err) {
    // Em caso de falha transitória de rede, preserva perfil em cache se existir
    return getStoredUserProfile();
  }
}

/**
 * Redireciona para o fluxo OpenID 2.0 da Steam
 */
export function startSteamLogin() {
  window.location.href = '/api/auth/steam/login';
}

/**
 * Encerra a sessão ativa
 */
export async function logoutUser(): Promise<void> {
  const token = getStoredSessionToken();
  clearSession();

  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (_) {
      // Ignora falha de rede no logout
    }
  }
}
