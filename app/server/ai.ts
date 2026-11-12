// AI handlers shared by the local Express server (server/index.ts) and the
// Netlify Function (netlify/functions/api.mts). The API key is read from the
// environment at request time and never leaves the server.
// The model never assigns TrustMap statuses: the client runs the deterministic
// rule engine on whatever the model returns.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { buildRegulatorySegments, claimSegmentId } from '../../localise/compose.ts';
import type { Finding, LocalisedContent, ProductInput, Segment } from '../../data/types.ts';

const model = () => process.env.PROOFLINGO_MODEL ?? 'claude-opus-5-5';
const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const LOCAL_TRANSLATOR_URL = 'http://127.0.0.1:8789';
const LOCAL_MODEL = 'TranslateGemma 4B + NLLB-200 600M';

let client: Anthropic | null = null;
function getClient() {
  if (!isConfigured()) throw new HttpError(503, 'Live AI is not configured on the server.');
  client ??= new Anthropic();
  return client;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

const LocalTranslationSchema = z.object({
  segments: z.array(
    z.object({
      segment_id: z.string(),
      source: z.string(),
      localised: z.string(),
    }),
  ),
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
  const response = await getClient().beta.messages.parse({
    model: model(),
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

// ---------- handlers ----------

export function aiStatus() {
  const configured = isConfigured();
  return { configured, model: configured ? model() : null };
}

export async function localTranslatorStatus() {
  try {
    const response = await fetch(`${LOCAL_TRANSLATOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return { available: false, model: null };
    const health = z.object({ ready: z.boolean(), model: z.string() }).parse(await response.json());
    return { available: health.ready, model: health.ready ? health.model : null };
  } catch {
    return { available: false, model: null };
  }
}

async function translateLocally(segments: Array<{ segment_id: string; source: string }>, productName: string) {
  let response: Response;
  try {
    response = await fetch(`${LOCAL_TRANSLATOR_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments, protected_terms: [productName] }),
    });
  } catch {
    throw new HttpError(503, 'Local translation models are not running. Start the local translation service and try again.');
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body);
    throw new HttpError(response.status >= 500 ? 502 : response.status, error.success ? error.data.error : 'Local translation failed.');
  }
  return LocalTranslationSchema.parse(body).segments;
}

export async function generateContent(body: unknown): Promise<LocalisedContent> {
  const product = ProductSchema.parse((body as { product?: unknown })?.product) as ProductInput;
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

  return { mode: 'ai', model: model(), generatedAt: new Date().toISOString(), segments };
}

export async function generateLocalContent(body: unknown): Promise<LocalisedContent> {
  const product = ProductSchema.parse((body as { product?: unknown })?.product) as ProductInput;
  const claims = product.claims.filter((claim) => claim.trim());
  const inputs = [
    ...(product.category.trim() ? [{ segment_id: 'title-category', source: product.category.trim() }] : []),
    ...(product.description.trim() ? [{ segment_id: 'ls-desc', source: product.description.trim() }] : []),
    ...claims.map((claim, index) => ({ segment_id: claimSegmentId(index), source: claim.trim() })),
  ];
  const translated = inputs.length ? await translateLocally(inputs, product.name) : [];
  if (translated.some((segment) => !segment.localised.trim())) {
    throw new HttpError(502, 'The local translation service returned an empty translation.');
  }
  const translations = new Map(translated.map((segment) => [segment.segment_id, segment.localised]));
  if (inputs.some((input) => !translations.has(input.segment_id))) {
    throw new HttpError(502, 'The local translation service returned an incomplete result.');
  }
  const translationFor = (id: string) => {
    const translation = translations.get(id);
    if (translation === undefined) throw new HttpError(502, 'The local translation service returned an incomplete result.');
    return translation;
  };
  const category = product.category.trim() ? translationFor('title-category') : '';

  const localSegment = (segment: Omit<Segment, 'origin'>): Segment => ({ ...segment, origin: 'local' });
  const segments: Segment[] = [
    localSegment({
      id: 'ls-title',
      docType: 'listing',
      field: 'Title',
      en: [product.name, product.category, product.size].filter(Boolean).join(', '),
      de: [product.name, category, product.size].filter(Boolean).join(', '),
    }),
    ...(product.description.trim()
      ? [
          localSegment({
            id: 'ls-desc',
            docType: 'listing',
            field: 'Short description',
            en: product.description,
            de: translationFor('ls-desc'),
          }),
        ]
      : []),
    ...claims.map((claim, index) =>
      localSegment({
        id: claimSegmentId(index),
        docType: 'listing',
        field: `Key benefit ${index + 1}`,
        en: claim.trim(),
        de: translationFor(claimSegmentId(index)),
        claimRef: claim.trim().toLowerCase().replace(/\s+/g, ' '),
      }),
    ),
    { id: 'ls-size', docType: 'listing', field: 'Size', en: product.size, de: product.size, factKey: 'size', origin: 'deterministic' },
    { id: 'pi-name', docType: 'info', field: 'Product name', en: product.name, de: product.name, origin: 'deterministic' },
    ...buildRegulatorySegments(product),
  ];
  return { mode: 'local', model: LOCAL_MODEL, generatedAt: new Date().toISOString(), segments };
}

export async function reviseSegment(body: unknown) {
  const b = body as { product?: unknown; segment?: unknown; findings?: unknown };
  const product = ProductSchema.parse(b?.product) as ProductInput;
  const segment = z.object({ en: z.string().max(2000), de: z.string().max(2000), field: z.string().max(100) }).parse(b?.segment);
  const findings = z
    .array(z.object({ title: z.string().max(300), explanation: z.string().max(2000) }))
    .max(20)
    .parse(b?.findings) as Pick<Finding, 'title' | 'explanation'>[];
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
  return callModel(REVISION_SYSTEM, user, RevisionSchema);
}

/** Maps any error to a safe HTTP response. Never includes the API key. */
export function toErrorResponse(err: unknown): { status: number; body: { error: string; issues?: unknown } } {
  if (err instanceof z.ZodError) return { status: 400, body: { error: 'Invalid request or model output.', issues: err.issues.slice(0, 5) } };
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  if (err instanceof Anthropic.APIError) {
    console.error('Anthropic API error', err.status, err.message);
    // Pass through the provider's own reason (e.g. low credit, invalid key).
    const reason = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return { status: 502, body: { error: `Model provider error (${err.status ?? 'network'})${reason ? `: ${reason}` : '.'}` } };
  }
  // The SDK throws its own error when the model's JSON does not match the schema.
  if (err instanceof Anthropic.AnthropicError && /structured output/i.test(err.message)) {
    console.error('Model output failed schema validation');
    return { status: 502, body: { error: 'The model response did not match the required schema. Nothing was generated; try again.' } };
  }
  console.error(err);
  return { status: 500, body: { error: 'Unexpected server error.' } };
}
