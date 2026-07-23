// Minimal browser auth helper for VPS self-hosted variant.
// GoTrue removed — auth is JWT cookie via /api/auth/*.
export const supabase = {
  auth: {
    async signOut() {
      await fetch('/api/auth/logout', { method: 'POST' });
    },
  },
};
