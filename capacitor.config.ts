import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vercel.meetingschedulerpro',
  appName: 'Meeting Scheduler Pro',
  webDir: 'capacitor-www',
  server: {
    url: 'https://meeting-scheduler-pro.vercel.app',
    cleartext: false,
  },
};

export default config;
