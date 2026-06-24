import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.comune.catastosegnaletica',
  appName: 'Catasto Segnaletica',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Geolocation: {
      permissions: ['precise'],
    },
  },
};

export default config;
