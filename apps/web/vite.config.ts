import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_LOCAL = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // No Windows o watcher nativo às vezes perde alterações e o Vite serve um módulo antigo.
    watch: { usePolling: true, interval: 300 },
    // Túnel (ngrok) para testar no celular: aceita o domínio dele.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev'],
    // Em desenvolvimento a web fala com a API pela mesma origem: um túnel só serve tudo.
    proxy: {
      // xfwd: a API recebe o host original (localhost ou o domínio do túnel) para montar o link do QR.
      '/api': { target: API_LOCAL, changeOrigin: true, xfwd: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/tempo-real': { target: API_LOCAL, changeOrigin: true, ws: true },
    },
  },
});
