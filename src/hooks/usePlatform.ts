import { useState, useEffect } from 'react';

type Platform = 'web' | 'android' | 'ios';

interface PlatformInfo {
  platform: Platform;
  isNative: boolean;   // true quando roda dentro do Capacitor (app instalado)
  isWeb: boolean;      // true quando roda no browser
  isAndroid: boolean;
  isIos: boolean;
  isReady: boolean;    // false durante SSR / antes do Capacitor inicializar
}

/**
 * Detecta se o app está rodando como web ou como app nativo (Android/iOS via Capacitor).
 *
 * Uso:
 *   const { isNative, platform } = usePlatform();
 *   if (isNative) { // lógica específica do app }
 */
export function usePlatform(): PlatformInfo {
  const [info, setInfo] = useState<PlatformInfo>({
    platform: 'web',
    isNative: false,
    isWeb: true,
    isAndroid: false,
    isIos: false,
    isReady: false,
  });

  useEffect(() => {
    async function detect() {
      // Capacitor expõe window.Capacitor quando está disponível
      const cap = (window as any).Capacitor;

      if (!cap) {
        // Rodando no browser normal
        setInfo({
          platform: 'web',
          isNative: false,
          isWeb: true,
          isAndroid: false,
          isIos: false,
          isReady: true,
        });
        return;
      }

      const platform: Platform = cap.getPlatform?.() ?? 'web';
      const isNative = cap.isNativePlatform?.() ?? false;

      setInfo({
        platform,
        isNative,
        isWeb: platform === 'web',
        isAndroid: platform === 'android',
        isIos: platform === 'ios',
        isReady: true,
      });
    }

    detect();
  }, []);

  return info;
}

/**
 * Versão síncrona simples — sem estado, sem re-render.
 * Use quando precisar do valor fora de componentes React.
 */
export function getPlatformSync(): Platform {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as any).Capacitor;
  if (!cap) return 'web';
  return cap.getPlatform?.() ?? 'web';
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}
