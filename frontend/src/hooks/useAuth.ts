import { useState, useEffect, useCallback } from 'react';
import {
  MechanicUser,
  getStoredUserProfile,
  getStoredSessionToken,
  extractAuthFromUrl,
  getAuthErrorFromUrl,
  checkAuthStatus,
  startSteamLogin,
  logoutUser,
} from '../services/authService';
import { toast } from 'sonner';

export function useAuth() {
  const [user, setUser] = useState<MechanicUser | null>(() => getStoredUserProfile());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Verifica se retornou da Steam com token na URL
    const urlAuth = extractAuthFromUrl();
    if (urlAuth) {
      setUser(urlAuth.user);
      setIsLoading(false);
      toast.success(`Bem-vindo, ${urlAuth.user.nome}!`, {
        description: 'Autenticado com sucesso via Steam.',
        duration: 4000,
      });
      return;
    }

    // 2. Verifica se retornou com erro de autorização
    const error = getAuthErrorFromUrl();
    if (error) {
      if (error === 'not_authorized') {
        setAuthError('Sua conta Steam não está cadastrada no quadro ativo da Mecânica BRP.');
        toast.error('Acesso Restrito', {
          description: 'Sua conta Steam não foi encontrada no quadro de mecânicos autorizados.',
          duration: 6000,
        });
      } else {
        setAuthError('Falha na validação com a Steam. Tente novamente.');
        toast.error('Erro de Autenticação Steam');
      }
    }

    // 3. Valida sessão armazenada no localStorage
    const token = getStoredSessionToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    checkAuthStatus()
      .then((validatedUser) => {
        setUser(validatedUser);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(() => {
    startSteamLogin();
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    toast.info('Sessão Steam encerrada.');
  }, []);

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    login,
    logout,
  };
}
