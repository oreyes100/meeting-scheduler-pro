import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vercel.meetingschedulerpro',
  appName: 'Meeting Scheduler Pro',
  webDir: 'capacitor-www',
  server: {
    // Producción self-hosted (VPS). La rama desplegada es `vps-selfhosted`;
    // el antiguo despliegue de Vercel sirve `main` y quedó desactualizado.
    url: 'https://congregaciontj.duckdns.org/meetings',
    cleartext: false,
    errorPath: 'error.html',
  },
};

export default config;
