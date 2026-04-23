import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isNativeApp } from '@/hooks/usePlatform';

/**
 * Hook que escuta deep links do Capacitor e processa callbacks do Supabase Auth.
 *
 * Adicionar em App.tsx dentro do componente App:
 *   useDeepLink();
 *
 * Funciona somente no app nativo — no browser o Supabase já trata os redirects normalmente.
 */
export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;

    // Registra o listener de URL do Capacitor
    async function setupDeepLink() {
      try {
        const { App } = await import('@capacitor/app');

        // Trata links que abrem o app quando está fechado
        const { url } = await App.getLaunchUrl() ?? {};
        if (url) handleUrl(url);

        // Trata links enquanto o app está aberto
        App.addListener('appUrlOpen', ({ url }) => handleUrl(url));
      } catch {
        // @capacitor/app não instalado ainda — ignorar
      }
    }

    function handleUrl(url: string) {
      // financeflow://reset-password#access_token=...&type=recovery
      if (!url.startsWith('financeflow://')) return;

      // Extrai o fragment (hash) da URL do deep link
      const fragment = url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);

      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type         = params.get('type');

      if (accessToken && refreshToken) {
        // Seta a sessão no Supabase com os tokens recebidos
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => {
            if (type === 'recovery') {
              navigate('/reset-password');
            } else {
              navigate('/');
            }
          });
      }
    }

    setupDeepLink();
  }, [navigate]);
}
