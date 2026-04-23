import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.financeflow.app',
  appName: 'FinanceFlow',
  webDir: 'dist',
  server: {
    // Em desenvolvimento, aponta pro Vite local (remover em produção)
    // url: 'http://192.168.x.x:8080',
    // cleartext: true,
  },
  plugins: {
    // Deep link para o Supabase Auth callback
    App: {
      urlScheme: 'financeflow',
    },
    // Barra de status do dispositivo
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0a0a0f',
    },
    // Tela de splash
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a0a0f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    // Teclado: não empurra o layout quando aberto
    Keyboard: {
      resize: 'none',
    },
  },
  android: {
    // Permite HTTP em dev (remover em produção)
    allowMixedContent: false,
    // Esconde a barra de navegação nativa
    captureInput: true,
    webContentsDebuggingEnabled: false, // true apenas em desenvolvimento
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
};

export default config;
