/**
 * Standalone Production Express Server
 */

import express from 'express';
import path from 'path';
import { apiRouter } from './api/routes.ts';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount API routes
app.use('/api', apiRouter);

// In production, serve built frontend
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

if (process.env.NODE_ENV === 'production' || process.env.RUN_STANDALONE) {
  app.listen(PORT, () => {
    console.log(`DigiMarket Server listening on port ${PORT}`);
  });
}

export default app;
