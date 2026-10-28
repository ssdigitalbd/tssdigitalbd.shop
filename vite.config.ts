import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import express from 'express';
import { apiRouter } from './server/api/routes.ts';

const apiApp = express();
apiApp.use(express.json({ limit: '10mb' }));
apiApp.use('/uploads', express.static(path.resolve(process.cwd(), '.data', 'uploads')));
apiApp.get('/health', (_req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
apiApp.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
apiApp.use('/api', apiRouter);

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          server.middlewares.use(apiApp);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
