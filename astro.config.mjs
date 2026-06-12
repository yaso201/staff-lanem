import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Front statique : tout le runtime (rôles, gating) est côté client.
  // Passer à un adapter (Cloudflare) le jour où l'auth Frappe l'exige.
});
