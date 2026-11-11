// Netlify Function serving the same /api routes as the local Express server.
// public/_redirects sends /api/* here. The Anthropic key comes from the site's
// environment variables (Functions scope) and never reaches the browser.

import { aiStatus, generateContent, reviseSegment, toErrorResponse } from '../../server/ai.ts';

interface NetlifyEvent {
  httpMethod: string;
  path: string;
  rawUrl?: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

const MAX_BODY_BYTES = 200_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_AI_CALLS = 20; // per visitor, per warm instance, per window

const calls = new Map<string, number[]>();
function allow(ip: string) {
  const now = Date.now();
  const recent = (calls.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_AI_CALLS) return false;
  recent.push(now);
  calls.set(ip, recent);
  return true;
}

const json = (body: unknown, statusCode = 200) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

/** "/api/generate" or "/.netlify/functions/api/generate" → "generate" */
function route(e: NetlifyEvent) {
  const p = e.rawUrl ? new URL(e.rawUrl).pathname : e.path;
  return p.replace(/\/+$/, '').split('/').pop() ?? '';
}

export const handler = async (event: NetlifyEvent) => {
  const r = route(event);
  try {
    if (r === 'status' && event.httpMethod === 'GET') return json(aiStatus());
    if (event.httpMethod !== 'POST' || (r !== 'generate' && r !== 'revise')) return json({ error: 'Not found.' }, 404);

    const ip = event.headers['x-nf-client-connection-ip'] ?? event.headers['x-forwarded-for'] ?? 'unknown';
    if (!allow(ip)) return json({ error: 'Too many AI requests. Please wait a few minutes and try again.' }, 429);

    const raw = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : (event.body ?? '');
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON.' }, 400);
    }
    return json(r === 'generate' ? await generateContent(body) : await reviseSegment(body));
  } catch (e) {
    const res = toErrorResponse(e);
    return json(res.body, res.status);
  }
};
