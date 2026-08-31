import { useEffect } from 'react';
import { isNativeApp } from '@/hooks/usePlatform';

/**
 * Hook que escuta deep links do Capacitor e processa callbacks do Firebase Auth.
 *
 * Adicionar em App.tsx dentro do componente App:
 *   useDeepLink();
 *
 * Funciona somente no app nativo — no browser o Firebase já trata os redirects
 * normalmente (o link do e-mail abre direto no navegador).
 *
 * O link de redefinição de senha do Firebase vem como:
 *   financeflow://reset-password?mode=resetPassword&oobCode=xxxx&apiKey=...
 * (query string, diferente do fragment #access_token=... que o Supabase usava)
 */
export function useDeepLink() {
  useEffect(() => {
    if (!isNativeApp()) return;

    async function setupDeepLink() {
      try {
        const { App } = await import('@capacitor/app');

        const { url } = await App.getLaunchUrl() ?? {};
        if (url) handleUrl(url);

        App.addListener('appUrlOpen', ({ url }) => handleUrl(url));
      } catch {
        // @capacitor/app não instalado ainda — ignorar
      }
    }

    function handleUrl(url: string) {
      if (!url.startsWith('financeflow://')) return;

      const query = url.split('?')[1] ?? '';
      const params = new URLSearchParams(query);
      const mode = params.get('mode');

      if (mode === 'resetPassword' && params.get('oobCode')) {
        // Navegação forçada (não via react-router) pra garantir que o App.tsx
        // reavalie do zero se deve mostrar a tela de redefinição de senha.
        window.location.href = `/reset-password?${query}`;
      }
    }

    setupDeepLink();
  }, []);
}
