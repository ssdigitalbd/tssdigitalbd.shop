/**
 * DigiMarket Production Server Entry Point
 * Full-stack Express server with API routing and React SPA fallback.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './server/api/routes.ts';

const app = express();
const PORT = process.env.PORT || 3000;

// Production Trust Proxy (Hostinger / Reverse Proxy / Cloudflare)
app.set('trust proxy', 1);

// JSON and URL-encoded body parsers with 10MB limit for screenshot evidence
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API router
app.use('/api', apiRouter);

// Static uploads delivery for product images
const uploadsPath = path.resolve(process.cwd(), '.data', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath, { maxAge: '7d' }));

// Static frontend delivery
const distPath = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distPath, 'index.html');

if (fs.existsSync(distPath)) {
  // Serve built assets
  app.use(
    express.static(distPath, {
      maxAge: '1d',
      index: false,
    })
  );

  // SPA fallback: send index.html for any non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found.' });
    }
    res.sendFile(indexPath);
  });
} else {
  // Development fallback message if dist not yet built
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found.' });
    }
    res.status(200).send(
      'SSDigitalBD.shop Backend Running. Run "npm run build" to generate client production bundle.'
    );
  });
}

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`[SSDigitalBD.shop] Production server listening on port ${PORT}`);
});

// Graceful termination handling
process.on('SIGTERM', () => {
  console.log('[SSDigitalBD.shop] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

export default app;
