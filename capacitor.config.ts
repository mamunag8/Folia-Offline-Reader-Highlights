import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kasbllc.folia',
  appName: 'Folia',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  backgroundColor: '#FAF7F2'
};

export default config;
