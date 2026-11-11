import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleContent, sampleRevisionFor } from '../localise/compose.ts';
import { SAMPLE_PRODUCT } from '../data/sample.ts';
import { segmentStatus, validate } from '../trust/rules.ts';
import { getProvision } from '../regulatory/sources.ts';
import type { LocalisedContent, ProductInput, Segment } from '../data/types.ts';

const product = () => structuredClone(SAMPLE_PRODUCT);
const seg = (id: string, en: string, de: string, extra: Partial<Segment> = {}): Segment => ({
  id,
  docType: 'marketing',
  field: 'Test',
  en,
  de,
  origin: 'model',
  ...extra,
});
const one = (p: ProductInput, s: Segment) => {
  const content: LocalisedContent = { mode: 'ai', generatedAt: '', segments: [s] };
  return validate(p, content).findings;
};

test('demo flow: clinical claim is blocked, revision resolves it, unrelated checks stay open', () => {
  const p = product();
  const content = generateSampleContent(p);
  const before = validate(p, content).findings;
  const clinical = content.segments.find((s) => s.en.startsWith('Clinically proven'))!;
  assert.equal(segmentStatus(before, clinical.id), 'blocked');
  assert.ok(before.some((f) => f.segmentId === clinical.id && f.ruleId === 'R01' && f.status === 'blocked'));

  // Apply curated revisions to every blocked statement derived from the claim.
  const revised = {
    ...content,
    segments: content.segments.map((s) => {
      if (segmentStatus(before, s.id) !== 'blocked') return s;
      const r = sampleRevisionFor(s);
      assert.ok(r, `revision exists for ${s.id}`);
      return { ...s, en: r.en, de: r.de, origin: 'revision' as const };
    }),
  };
  const after = validate(p, revised).findings;
  assert.equal(after.filter((f) => f.status === 'blocked').length, 0);
  assert.equal(segmentStatus(after, clinical.id), 'supported');
  // Unrelated regulatory items remain pending.
  for (const id of ['pi-rp', 'pi-safety', 'pi-cpnp']) assert.equal(segmentStatus(after, id), 'review', id);
});

test('adding a clinical study downgrades the blocker to expert review, never to supported', () => {
  const p = product();
  p.evidence.push({ id: 'ev-c', kind: 'clinical-study', title: 'Study', details: 'Wrinkle depth at 7 days', jurisdiction: 'n/a' });
  const f = one(p, seg('x', 'Clinically tested formula', 'Klinisch getestete Formel'));
  assert.equal(f.find((x) => x.ruleId === 'R01')?.status, 'review');
});

test('numbers changed in translation are blocked', () => {
  const f = one(product(), seg('x', 'Up to 24-hour hydration', 'Bis zu 48 Stunden Feuchtigkeit'));
  assert.equal(f.find((x) => x.ruleId === 'R14')?.status, 'blocked');
});

test('German text that adds a claim is blocked', () => {
  const f = one(product(), seg('x', 'A lightweight daily cream.', 'Eine klinisch getestete, leichte Tagescreme.'));
  assert.equal(f.find((x) => x.ruleId === 'R15')?.status, 'blocked');
});

test('free-from claim contradicted by INCI is blocked', () => {
  const p = product();
  p.ingredients += ', Parfum';
  const f = one(p, seg('x', 'Fragrance-free formula', 'Parfümfreie Formel'));
  assert.equal(f.find((x) => x.ruleId === 'R07')?.status, 'blocked');
});

test('ingredient claim not in INCI list is blocked', () => {
  const f = one(product(), seg('x', 'With retinol', 'Mit Retinol'));
  assert.equal(f.find((x) => x.ruleId === 'R06')?.status, 'blocked');
});

test('volume that does not match product size is blocked', () => {
  const f = one(product(), seg('x', 'Generous 100 ml jar', 'Großzügiger 100 ml Tiegel'));
  assert.equal(f.find((x) => x.ruleId === 'R13')?.status, 'blocked');
});

test('hydration claim longer than measured is blocked', () => {
  const f = one(product(), seg('x', 'Up to 48-hour hydration', 'Bis zu 48 Stunden Feuchtigkeit'));
  assert.equal(f.find((x) => x.ruleId === 'R04')?.status, 'blocked');
});

test('medicinal wording is blocked; "healthy" is not medicinal', () => {
  assert.equal(one(product(), seg('x', 'Treats eczema', 'Behandelt Ekzeme')).find((x) => x.ruleId === 'R08')?.status, 'blocked');
  assert.equal(one(product(), seg('y', 'For healthy-looking skin', 'Für gesund aussehende Haut')).find((x) => x.ruleId === 'R08'), undefined);
});

test('topics without a curated source report a source gap', () => {
  const f = one(product(), seg('x', 'Naturally derived care', 'Pflege natürlichen Ursprungs'));
  const n = f.find((x) => x.ruleId === 'R11')!;
  assert.equal(n.status, 'review');
  assert.ok(n.sourceGap);
});

test('every cited provision exists in the curated library', () => {
  const p = product();
  const all = validate(p, generateSampleContent(p)).findings;
  for (const f of all) for (const r of f.sourceRefs) assert.ok(getProvision(r.sourceId, r.provisionId), `${r.sourceId}/${r.provisionId}`);
});

test('sensory claim must match the sensation the evidence assessed', () => {
  const p = product(); // perception test covers softness and comfort only
  assert.equal(one(p, seg('x', 'Skin feels softer', 'Weicheres Hautgefühl')).find((f) => f.ruleId === 'R05')?.status, 'supported');
  assert.equal(one(p, seg('y', 'Skin looks smoother', 'Glatteres Hautgefühl')).find((f) => f.ruleId === 'R05')?.status, 'review');
});

test('inflected German claim words are detected (model adds "dermatologisch getestete")', () => {
  const f = one(product(), seg('x', 'A lightweight cream that leaves skin feeling softer.', 'Eine leichte, dermatologisch getestete Creme für ein weicheres Hautgefühl.'));
  assert.equal(f.find((x) => x.ruleId === 'R15')?.status, 'blocked');
  assert.equal(f.find((x) => x.ruleId === 'R01')?.status, 'blocked');
});
