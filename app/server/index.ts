// ProofLingo API server. Holds the API key; the browser never sees it.
//   GET  /api/status    → whether connected AI mode is available
//   POST /api/generate  → structured German localisation (schema-validated)
//   POST /api/revise    → draft a revision for a flagged statement
// The model never assigns TrustMap statuses: the client runs the deterministic
// rule engine on whatever the model returns.

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { buildRegulatorySegments, claimSegmentId } from '../../localise/compose.ts';
import type { Finding, LocalisedContent, ProductInput, Segment } from '../../data/types.ts';

const PORT = Number(process.env.API_PORT ?? 8787);
const MODEL = process.env.PROOFLINGO_MODEL ?? 'claude-opus-5-5';
const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = configured ? new Anthropic() : null;

const app = express();
app.use(express.json({ limit: '200kb' }));

// ---------- schemas ----------

const Pair = z.object({ en: z.string(), de: z.string() });

const GenerationSchema = z.object({
  listing: z.object({
    title: Pair,
    description: Pair,
    benefits: z.array(z.object({ claimIndex: z.number().int(), de: z.string() })),
  }),
  marketing: z.object({
    headline: Pair,
    body: z.array(Pair),
    socialCaption: Pair,
    callToAction: Pair,
  }),
  info: z.object({ directions: Pair, precautions: Pair }),
});

const RevisionSchema = z.object({ en: z.string(), de: z.string(), rationale: z.string() });

const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(200),
  description: z.string().max(2000),
  size: z.string().max(50),
  ingredients: z.string().max(4000),
  claims: z.array(z.string().max(500)).max(20),
  evidence: z
    .array(
      z.object({
        id: z.string(),
        kind: z.string(),
        title: z.string().max(300),
        details: z.string().max(2000),
        jurisdiction: z.string(),
      }),
    )
    .max(30),
  targetCountry: z.literal('DE'),
});

// ---------- prompts ----------

const GENERATION_SYSTEM = `You localise UK cosmetic product content for the German market.
Rules you must follow:
- Translate faithfully into natural, idiomatic German for German consumers (formal "Sie").
- Never add, strengthen, or invent claims. Marketing copy may only restate the claims and description provided.
- Keep every number, unit, percentage and duration exactly as in the source.
- Keep the product name exactly as provided (do not translate the brand).
- Do not write anything about regulatory status, approvals, certifications or test results that are not in the input.
- For benefits, return exactly one German translation per input claim, using its zero-based claimIndex.
Your output is checked afterwards by a deterministic evidence engine; fluent wording does not make a claim acceptable.`;

const REVISION_SYSTEM = `You revise a flagged cosmetic marketing statement for the German market.
- The revision must only state what the listed evidence supports. If nothing is supported, write a neutral, non-claim statement.
- Never mention clinical proof, guarantees, timeframes or ingredients unless the evidence explicitly covers them.
- Keep numbers consistent between English and German.
- Return English and German versions, plus a one-sentence rationale.`;

function productBrief(p: ProductInput) {
  return [
    `Product name: ${p.name}`,
    `Category: ${p.category}`,
    `Size: ${p.size}`,
    `Description: ${p.description}`,
    `INCI: ${p.ingredients}`,
    `Claims:`,
    ...p.claims.map((c, i) => `  [${i}] ${c}`),
    `Evidence on file:`,
    ...(p.evidence.length ? p.evidence.map((e) => `  - (${e.kind}, ${e.jurisdiction}) ${e.title}: ${e.details}`) : ['  (none)']),
  ].join('\n');
}

async function callModel<T extends z.ZodType>(system: string, user: string, schema: T): Promise<z.infer<T>> {
  if (!client) throw new HttpError(503, 'AI mode is not configured on the server.');
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === 'refusal') throw new HttpError(502, 'The model declined this request.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'The model response was truncated.');
  if (!response.parsed_output) throw new HttpError(502, 'The model response did not match the required schema.');
  // Second, independent validation of the structure we rely on.
  return schema.parse(response.parsed_output);
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- routes ----------

app.get('/api/status', (_req, res) => {
  res.json({ configured, model: configured ? MODEL : null });
});

app.post('/api/generate', async (req, res, next) => {
  try {
    const product = ProductSchema.parse(req.body?.product) as ProductInput;
    const out = await callModel(GENERATION_SYSTEM, productBrief(product), GenerationSchema);
    const claims = product.claims.filter((c) => c.trim());

    const seg = (s: Omit<Segment, 'origin'>): Segment => ({ ...s, origin: 'model' });
    const segments: Segment[] = [
      seg({ id: 'ls-title', docType: 'listing', field: 'Title', ...out.listing.title }),
      // English source text comes from the input, never from the model.
      seg({ id: 'ls-desc', docType: 'listing', field: 'Short description', en: product.description, de: out.listing.description.de }),
      ...claims.map((claim, i) => {
        const de = out.listing.benefits.find((b) => b.claimIndex === i)?.de;
        return {
          id: claimSegmentId(i),
          docType: 'listing' as const,
          field: `Key benefit ${i + 1}`,
          en: claim.trim(),
          de: de ?? '[Keine Übersetzung geliefert]',
          untranslated: !de,
          claimRef: claim.trim().toLowerCase().replace(/\s+/g, ' '),
          origin: 'model' as const,
        };
      }),
      { id: 'ls-size', docType: 'listing', field: 'Size', en: product.size, de: product.size, factKey: 'size', origin: 'deterministic' },
      seg({ id: 'mk-headline', docType: 'marketing', field: 'Headline', ...out.marketing.headline }),
      ...out.marketing.body.map((b, i) => seg({ id: `mk-body-${i + 1}`, docType: 'marketing', field: 'Body copy', ...b })),
      seg({ id: 'mk-social', docType: 'marketing', field: 'Social caption', ...out.marketing.socialCaption }),
      seg({ id: 'mk-cta', docType: 'marketing', field: 'Call to action', ...out.marketing.callToAction }),
      { id: 'pi-name', docType: 'info', field: 'Product name', en: product.name, de: product.name, origin: 'deterministic' },
      seg({ id: 'pi-use', docType: 'info', field: 'Directions for use', ...out.info.directions }),
      seg({ id: 'pi-precautions', docType: 'info', field: 'Precautions', ...out.info.precautions }),
      ...buildRegulatorySegments(product),
    ];

    const content: LocalisedContent = { mode: 'ai', model: MODEL, generatedAt: new Date().toISOString(), segments };
    res.json(content);
  } catch (e) {
    next(e);
  }
});

app.post('/api/revise', async (req, res, next) => {
  try {
    const product = ProductSchema.parse(req.body?.product) as ProductInput;
    const segment = z.object({ en: z.string(), de: z.string(), field: z.string() }).parse(req.body?.segment);
    const findings = z.array(z.object({ title: z.string(), explanation: z.string() })).parse(req.body?.findings) as Pick<
      Finding,
      'title' | 'explanation'
    >[];
    const user = [
      productBrief(product),
      '',
      `Statement (${segment.field}):`,
      `EN: ${segment.en}`,
      `DE: ${segment.de}`,
      '',
      'Problems found by the evidence engine:',
      ...findings.map((f) => `- ${f.title}: ${f.explanation}`),
    ].join('\n');
    res.json(await callModel(REVISION_SYSTEM, user, RevisionSchema));
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
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request or model output.', issues: err.issues.slice(0, 5) });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof Anthropic.APIError) {
    console.error('Anthropic API error', err.status, err.message);
    // Pass through the provider's own reason (e.g. low credit, invalid key). It never contains the key.
    const reason = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return res.status(502).json({ error: `Model provider error (${err.status ?? 'network'})${reason ? `: ${reason}` : '.'}` });
  }
  // The SDK throws its own error when the model's JSON does not match the schema.
  if (err instanceof Anthropic.AnthropicError && /structured output/i.test(err.message)) {
    console.error('Model output failed schema validation');
    return res.status(502).json({ error: 'The model response did not match the required schema. Nothing was generated; try again.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`ProofLingo API on http://localhost:${PORT} · AI mode ${configured ? `connected (${MODEL})` : 'not configured — sample scenario only'}`);
});
