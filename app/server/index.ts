// ProofLingo local API server. Holds the API key; the browser never sees it.
//   GET  /api/status    → whether Live AI is available
//   POST /api/generate  → structured German localisation (schema-validated)
//   POST /api/revise    → draft a fix for a flagged sentence
// The AI logic lives in ./ai.ts and is shared with the Netlify Function.

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aiStatus, generateContent, reviseSegment, toErrorResponse } from './ai.ts';

const PORT = Number(process.env.API_PORT ?? 8787);

const app = express();
app.use(express.json({ limit: '200kb' }));

app.get('/api/status', (_req, res) => {
  res.json(aiStatus());
});

app.post('/api/generate', async (req, res, next) => {
  try {
    res.json(await generateContent(req.body));
  } catch (e) {
    next(e);
  }
});

app.post('/api/revise', async (req, res, next) => {
  try {
    res.json(await reviseSegment(req.body));
  } catch (e) {
    next(e);
  }
});

// Serve the built client when present (npm start).
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const r = toErrorResponse(err);
  res.status(r.status).json(r.body);
});

app.listen(PORT, () => {
  const s = aiStatus();
  console.log(`ProofLingo API on http://localhost:${PORT} · AI mode ${s.configured ? `connected (${s.model})` : 'not configured — sample scenario only'}`);
});
