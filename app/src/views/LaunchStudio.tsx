import { useState } from 'react';
import { ArrowRight, FlaskConical, Loader2, Plus, RotateCcw, Sparkles, Trash2, TriangleAlert, Cpu, FileText } from 'lucide-react';
import { navigate, useServer } from '../App';
import { generateSampleContent } from '../domain/compose';
import type { EvidenceItem, EvidenceKind, ProductInput } from '../domain/types';
import { generateWithAI } from '../lib/api';
import { useStore } from '../state/store';
import { summarise } from '../domain/rules';
import { Button, Card, Field, SectionTitle, StatusBadge, inputCls, cx } from '../components/ui';

export const EVIDENCE_KINDS: Array<{ value: EvidenceKind; label: string }> = [
  { value: 'clinical-study', label: 'Clinical study' },
  { value: 'instrumental-test', label: 'Instrumental test' },
  { value: 'consumer-perception', label: 'Consumer perception test' },
  { value: 'tolerance-test', label: 'Skin tolerance test' },
  { value: 'ingredient-spec', label: 'Formula / ingredient specification' },
  { value: 'safety-report', label: 'Cosmetic product safety report' },
  { value: 'eu-responsible-person', label: 'EU Responsible Person designation' },
  { value: 'cpnp-notification', label: 'CPNP notification' },
  { value: 'other', label: 'Other document' },
];

export const kindLabel = (k: EvidenceKind) => EVIDENCE_KINDS.find((e) => e.value === k)?.label ?? k;

export function LaunchStudio() {
  const { state, dispatch } = useStore();
  const { status } = useServer();
  const p = state.product;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<ProductInput>) => dispatch({ type: 'setProduct', product: { ...p, ...patch } });
  const setClaim = (i: number, v: string) => set({ claims: p.claims.map((c, j) => (j === i ? v : c)) });
  const setEvidence = (id: string, patch: Partial<EvidenceItem>) =>
    set({ evidence: p.evidence.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const ready = !!p.name.trim() && !!p.size.trim() && p.claims.some((c) => c.trim());
  const aiAvailable = !!status?.configured;
  const counts = state.content && state.validation ? summarise(state.validation.findings, state.content.segments) : null;

  async function generate() {
    setError(null);
    const product = { ...p, claims: p.claims.filter((c) => c.trim()) };
    if (state.mode === 'sample') {
      dispatch({ type: 'setContent', content: generateSampleContent(product) });
      return;
    }
    setBusy(true);
    try {
      const content = await generateWithAI(product);
      dispatch({ type: 'setContent', content });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* Product setup */}
      <Card className="p-5 sm:p-6">
        <SectionTitle
          title="Product setup"
          hint="What the business tells us. Claims are checked only against the evidence listed here."
          action={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'reset' })}>
                <RotateCcw size={14} aria-hidden /> Clear
              </Button>
              <Button variant={p.name ? 'secondary' : 'primary'} size="sm" onClick={() => dispatch({ type: 'loadExample' })}>
                <FlaskConical size={14} aria-hidden /> Load example product
              </Button>
            </div>
          }
        />

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name">
            <input id="name" className={inputCls} value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Daily Moisturiser" />
          </Field>
          <Field label="Category" htmlFor="category">
            <input id="category" className={inputCls} value={p.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Face moisturiser" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="description">
              <textarea id="description" rows={2} className={inputCls} value={p.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
          <Field label="Size" htmlFor="size" hint="Used to check every volume mentioned in the output.">
            <input id="size" className={inputCls} value={p.size} onChange={(e) => set({ size: e.target.value })} placeholder="e.g. 50 ml" />
          </Field>
          <Field label="Target country" htmlFor="country">
            <select id="country" className={inputCls} value={p.targetCountry} onChange={() => set({ targetCountry: 'DE' })}>
              <option value="DE">Germany (de-DE)</option>
              <option disabled>France — not yet supported</option>
              <option disabled>Netherlands — not yet supported</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Ingredients (INCI)" htmlFor="ingredients" hint="Comma separated. Ingredient and free-from claims are checked against this list.">
              <textarea id="ingredients" rows={3} className={cx(inputCls, 'font-mono text-[12.5px]')} value={p.ingredients} onChange={(e) => set({ ingredients: e.target.value })} />
            </Field>
          </div>
        </div>

        {/* Claims */}
        <div className="mt-7 border-t border-line pt-6">
          <SectionTitle title="Claims" hint="One claim per line, in English, as you use them in the UK." />
          <ul className="mt-4 space-y-2">
            {p.claims.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 w-5 text-right text-[12px] tabular-nums text-muted">{i + 1}</span>
                <input
                  aria-label={`Claim ${i + 1}`}
                  className={inputCls}
                  value={c}
                  onChange={(e) => setClaim(i, e.target.value)}
                  placeholder="e.g. Up to 24-hour hydration"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-0.5 shrink-0"
                  aria-label={`Remove claim ${i + 1}`}
                  onClick={() => set({ claims: p.claims.length > 1 ? p.claims.filter((_, j) => j !== i) : [''] })}
                >
                  <Trash2 size={14} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2 ml-5" onClick={() => set({ claims: [...p.claims, ''] })}>
            <Plus size={14} aria-hidden /> Add claim
          </Button>
        </div>

        {/* Evidence */}
        <div className="mt-7 border-t border-line pt-6">
          <SectionTitle
            title="Available supporting evidence"
            hint="Only what the business can actually produce. Anything missing here shows up as missing in TrustMap."
          />
          {p.evidence.length === 0 && <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-sm text-muted">No evidence listed. Every claim will be reported as unsupported.</p>}
          <ul className="mt-4 space-y-3">
            {p.evidence.map((e) => (
              <li key={e.id} className="rounded-lg border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)_110px_auto]">
                  <select aria-label="Evidence type" className={inputCls} value={e.kind} onChange={(ev) => setEvidence(e.id, { kind: ev.target.value as EvidenceKind })}>
                    {EVIDENCE_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <input aria-label="Evidence title" className={inputCls} value={e.title} onChange={(ev) => setEvidence(e.id, { title: ev.target.value })} placeholder="Title" />
                  <select
                    aria-label="Jurisdiction"
                    className={inputCls}
                    value={e.jurisdiction}
                    onChange={(ev) => setEvidence(e.id, { jurisdiction: ev.target.value as EvidenceItem['jurisdiction'] })}
                  >
                    <option value="n/a">Any</option>
                    <option value="UK">UK</option>
                    <option value="EU">EU</option>
                  </select>
                  <Button variant="ghost" size="sm" className="mt-0.5" aria-label={`Remove evidence ${e.title}`} onClick={() => set({ evidence: p.evidence.filter((x) => x.id !== e.id) })}>
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
                <textarea
                  aria-label="Evidence details"
                  rows={2}
                  className={cx(inputCls, 'mt-2 text-[13px]')}
                  value={e.details}
                  onChange={(ev) => setEvidence(e.id, { details: ev.target.value })}
                  placeholder="Method, sample size, timepoints, concentrations…"
                />
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              set({
                evidence: [...p.evidence, { id: `ev-${Math.random().toString(36).slice(2, 8)}`, kind: 'other', title: '', details: '', jurisdiction: 'n/a' }],
              })
            }
          >
            <Plus size={14} aria-hidden /> Add evidence
          </Button>
        </div>
      </Card>

      {/* Generation panel */}
      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card className="p-5">
          <SectionTitle title="Localise for Germany" />

          <div className="mt-4" role="radiogroup" aria-label="Generation mode">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1">
              {(
                [
                  { mode: 'sample', label: 'Sample scenario', Icon: FileText, disabled: false },
                  { mode: 'ai', label: 'Connected AI', Icon: Cpu, disabled: !aiAvailable },
                ] as const
              ).map(({ mode, label, Icon, disabled }) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={state.mode === mode}
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'setMode', mode })}
                  className={cx(
                    'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors',
                    state.mode === mode ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                    disabled && 'cursor-not-allowed opacity-50 hover:text-muted',
                  )}
                >
                  <Icon size={14} aria-hidden /> {label}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
              {state.mode === 'sample' ? (
                <>
                  Uses <strong className="font-medium text-ink-2">prewritten German text</strong> for the example product and the same deterministic checks. No model runs.
                  {p.name && p.name !== 'Northfield Oat & Ceramide Daily Moisturiser' && ' Text without a prewritten translation is flagged as untranslated.'}
                </>
              ) : (
                <>
                  Calls <strong className="font-medium text-ink-2">{status?.model}</strong> on the server with a validated output schema. The model writes text only; it cannot set TrustMap statuses.
                </>
              )}
            </p>
            {!aiAvailable && (
              <p className="mt-2 text-[12px] text-muted">
                {status === null
                  ? 'Checking for AI server…'
                  : status.reachable
                    ? 'Connected AI is unavailable: no API key configured on the server.'
                    : 'Connected AI is unavailable: the API server is not running.'}
              </p>
            )}
          </div>

          <ul className="mt-5 space-y-1.5 text-[13px] text-ink-2">
            <li>· German product listing and customer preview</li>
            <li>· German marketing draft</li>
            <li>· Translated product information document</li>
            <li>· TrustMap evidence check across all three</li>
          </ul>

          {state.productChangedSinceGeneration && (
            <p className="mt-4 flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> Product details changed since the last generation. Regenerate to update.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 flex gap-2 rounded-md bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> {error}
            </p>
          )}

          <Button variant="primary" className="mt-5 w-full" disabled={!ready || busy} onClick={generate}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
            {busy ? `Generating with ${status?.model}…` : state.content ? 'Regenerate German content' : 'Generate German content'}
          </Button>
          {!ready && <p className="mt-2 text-center text-[12px] text-muted">Add a product name, size and at least one claim, or load the example.</p>}
        </Card>

        {counts && (
          <Card className="p-5 fade-in">
            <SectionTitle title="Latest check" hint={`${state.content!.segments.length} statements inspected by ${state.validation!.rulesRun.length} rules`} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(['blocked', 'review', 'supported'] as const).map((s) => (
                <div key={s} className="rounded-lg border border-line p-3">
                  <div className="text-xl font-semibold tabular-nums">{counts[s]}</div>
                  <StatusBadge status={s} className="mt-1" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button variant="primary" className="flex-1 xl:flex-none" onClick={() => navigate('trustmap')}>
                Review in TrustMap <ArrowRight size={15} aria-hidden />
              </Button>
              <Button className="flex-1 xl:flex-none" onClick={() => navigate('content')}>
                Compare EN / DE
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
