import { useState } from 'react';
import { ArrowRight, Check, Cpu, FileText, Languages, Loader2, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { navigate, useServer } from '../App';
import { generateSampleContent } from '../../../localise/compose';
import type { EvidenceItem, EvidenceKind, ProductInput } from '../../../data/types';
import { generateWithAI, generateWithLocalModels } from '../lib/api';
import { useStore } from '../state/store';
import { HOSTED } from '../lib/env';
import { splitCounts } from '../../../trust/rules';
import { Button, Card, Field, STATUS_META, inputCls, cx } from '../components/ui';

export const EVIDENCE_KINDS: Array<{ value: EvidenceKind; label: string }> = [
  { value: 'clinical-study', label: 'Clinical study' },
  { value: 'instrumental-test', label: 'Instrumental test' },
  { value: 'consumer-perception', label: 'Consumer perception test' },
  { value: 'tolerance-test', label: 'Skin tolerance test' },
  { value: 'ingredient-spec', label: 'Formula specification' },
  { value: 'safety-report', label: 'Safety report' },
  { value: 'eu-responsible-person', label: 'EU Responsible Person' },
  { value: 'cpnp-notification', label: 'CPNP notification' },
  { value: 'other', label: 'Other document' },
];

export const kindLabel = (k: EvidenceKind) => EVIDENCE_KINDS.find((e) => e.value === k)?.label ?? k;

export function LaunchStudio() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const hasProduct = !!state.product.name.trim();

  if (!hasProduct && !editing) {
    return (
      <StartPanel
        onExample={() => dispatch({ type: 'loadExample' })}
        onOwn={() => {
          dispatch({ type: 'reset' });
          setEditing(true);
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {editing ? <ProductForm onDone={() => setEditing(false)} /> : <ProductSummary onEdit={() => setEditing(true)} />}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <GeneratePanel />
      </div>
    </div>
  );
}

/* ---------- Start ---------- */

function StartPanel({ onExample, onOwn }: { onExample: () => void; onOwn: () => void }) {
  const steps = [
    ['Describe your product', 'Its claims, ingredients and the evidence you can actually show.'],
    ['Get the German version', 'Product listing, marketing copy and product information.'],
    ['See what you can trust', 'Every sentence is checked against your evidence and EU cosmetics law.'],
  ];
  return (
    <Card className="mx-auto max-w-4xl px-6 py-10 sm:px-12 sm:py-14">
      <p className="text-[13px] font-semibold text-teal">United Kingdom → Germany</p>
      <h2 className="mt-3 max-w-2xl text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
        Launch a UK product in Germany, and know which claims you can back up.
      </h2>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">
        ProofLingo writes your German content, then marks each sentence green, amber or red depending on whether your evidence supports it.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={onExample}>
          Use the example product <ArrowRight size={16} aria-hidden />
        </Button>
        <Button size="lg" onClick={onOwn}>
          Enter my own product
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-muted">Example: Northfield Skincare’s daily moisturiser, a fictional UK brand.</p>

      <ol className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[13px] font-semibold text-ink ring-1 ring-line">{i + 1}</span>
            <h3 className="mt-3 text-[15px] font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------- Product summary (read mode) ---------- */

function ProductSummary({ onEdit }: { onEdit: () => void }) {
  const { state, dispatch } = useStore();
  const p = state.product;
  const claims = p.claims.filter((c) => c.trim());
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">Your product</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">{p.name}</h2>
          <p className="mt-1 text-[14px] text-muted">{[p.category, p.size].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onEdit}>
            <Pencil size={14} aria-hidden /> Edit details
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'reset' })}>
            <RotateCcw size={14} aria-hidden /> Start over
          </Button>
        </div>
      </div>
      {p.description && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">{p.description}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h3 className="text-[15px] font-semibold text-ink">Claims you want to make</h3>
          <p className="mt-0.5 text-[13px] text-muted">As used in the UK today.</p>
          <ol className="mt-3 space-y-2">
            {claims.map((c, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line px-3.5 py-2.5 text-[14.5px] text-ink">
                <span className="w-4 shrink-0 text-right text-[13px] tabular-nums text-muted">{i + 1}</span>
                {c}
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="text-[15px] font-semibold text-ink">Evidence you can show</h3>
          <p className="mt-0.5 text-[13px] text-muted">Claims are only checked against what is listed here.</p>
          {p.evidence.length ? (
            <ul className="mt-3 space-y-2">
              {p.evidence.map((e) => (
                <li key={e.id} className="rounded-lg border border-line px-3.5 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[14.5px] font-medium text-ink">{e.title}</span>
                    <span className="text-[12px] text-muted">
                      {kindLabel(e.kind)}
                      {e.jurisdiction !== 'n/a' && ` · ${e.jurisdiction}`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{e.details}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-canvas px-4 py-3 text-[14px] text-muted">No evidence listed, so every claim will be reported as unsupported.</p>
          )}
        </section>
      </div>
    </Card>
  );
}

/* ---------- Product form (edit mode) ---------- */

function ProductForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useStore();
  const p = state.product;
  const set = (patch: Partial<ProductInput>) => dispatch({ type: 'setProduct', product: { ...p, ...patch } });
  const setClaim = (i: number, v: string) => set({ claims: p.claims.map((c, j) => (j === i ? v : c)) });
  const setEvidence = (id: string, patch: Partial<EvidenceItem>) => set({ evidence: p.evidence.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold tracking-tight">Product details</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'loadExample' })}>
            Fill with example
          </Button>
          <Button size="sm" variant="primary" onClick={onDone} disabled={!p.name.trim()}>
            <Check size={14} aria-hidden /> Done
          </Button>
        </div>
      </div>

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
        <Field label="Size" htmlFor="size">
          <input id="size" className={inputCls} value={p.size} onChange={(e) => set({ size: e.target.value })} placeholder="e.g. 50 ml" />
        </Field>
        <Field label="Target country" htmlFor="country">
          <select id="country" className={inputCls} value={p.targetCountry} onChange={() => set({ targetCountry: 'DE' })}>
            <option value="DE">Germany</option>
            <option disabled>France (coming later)</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ingredients (INCI list)" htmlFor="ingredients" hint="Comma separated.">
            <textarea id="ingredients" rows={3} className={cx(inputCls, 'font-mono text-[12.5px]')} value={p.ingredients} onChange={(e) => set({ ingredients: e.target.value })} />
          </Field>
        </div>
      </div>

      <section className="mt-8 border-t border-line pt-6">
        <h3 className="text-[15px] font-semibold">Claims</h3>
        <p className="mt-0.5 text-[13px] text-muted">One per line, in English.</p>
        <ul className="mt-3 space-y-2">
          {p.claims.map((c, i) => (
            <li key={i} className="flex gap-2">
              <input aria-label={`Claim ${i + 1}`} className={inputCls} value={c} onChange={(e) => setClaim(i, e.target.value)} placeholder="e.g. Up to 24-hour hydration" />
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
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => set({ claims: [...p.claims, ''] })}>
          <Plus size={14} aria-hidden /> Add claim
        </Button>
      </section>

      <section className="mt-8 border-t border-line pt-6">
        <h3 className="text-[15px] font-semibold">Evidence</h3>
        <p className="mt-0.5 text-[13px] text-muted">Only list what you can actually produce.</p>
        <ul className="mt-3 space-y-3">
          {p.evidence.map((e) => (
            <li key={e.id} className="rounded-lg border border-line p-3">
              <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)_100px_auto]">
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
          onClick={() => set({ evidence: [...p.evidence, { id: `ev-${Math.random().toString(36).slice(2, 8)}`, kind: 'other', title: '', details: '', jurisdiction: 'n/a' }] })}
        >
          <Plus size={14} aria-hidden /> Add evidence
        </Button>
      </section>
    </Card>
  );
}

/* ---------- Generate / result ---------- */

function GeneratePanel() {
  const { state, dispatch } = useStore();
  const { status } = useServer();
  const p = state.product;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!p.name.trim() && !!p.size.trim() && p.claims.some((c) => c.trim());
  const aiAvailable = !!status?.configured;
  const localAvailable = !HOSTED && !!status?.local.available;
  const counts = state.content && state.validation ? splitCounts(state.validation.findings, state.content.segments) : null;
  const fresh = counts && !state.productChangedSinceGeneration;

  async function generate() {
    setError(null);
    const product = { ...p, claims: p.claims.filter((c) => c.trim()) };
    if (state.mode === 'sample') {
      dispatch({ type: 'setContent', content: generateSampleContent(product) });
      return;
    }
    setBusy(true);
    try {
      const content = state.mode === 'ai' ? await generateWithAI(product) : await generateWithLocalModels(product);
      dispatch({ type: 'setContent', content });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      {fresh ? (
        <div className="fade-in">
          <p className="text-[13px] font-medium text-muted">German content ready</p>
          <h2 className="mt-1 text-[20px] font-semibold leading-snug tracking-tight">
            {counts.blocked > 0 ? `${counts.blocked} sentence${counts.blocked > 1 ? 's' : ''} to fix before you publish.` : 'Nothing to fix.'}
          </h2>
          <ul className="mt-4 space-y-2 text-[14px]">
            {(['blocked', 'review', 'supported'] as const).map((s) => (
              <li key={s} className="flex items-center gap-2.5">
                <span className={cx('h-2.5 w-2.5 rounded-full', STATUS_META[s].dot)} aria-hidden />
                <span className="w-6 font-semibold tabular-nums">{counts[s]}</span>
                <span className="text-ink-2">{STATUS_META[s].short}</span>
              </li>
            ))}
            <li className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-line-2" aria-hidden />
              <span className="w-6 font-semibold tabular-nums">{counts.launchOpen}</span>
              <span className="text-ink-2">Launch steps to sort</span>
            </li>
          </ul>
          <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => navigate('trustmap')}>
            {counts.blocked > 0 ? 'Review and fix' : 'Review'} <ArrowRight size={16} aria-hidden />
          </Button>
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" onClick={() => navigate('content')}>
              See side by side
            </Button>
            <Button variant="ghost" onClick={generate} disabled={busy} title="Generate again">
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RotateCcw size={14} aria-hidden />}
              <span className="sr-only">Generate again</span>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-[18px] font-semibold tracking-tight">Create the German version</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            {state.mode === 'local'
              ? 'Translate the supplied product text locally, then check it straight away. No new marketing copy is invented.'
              : 'A product listing, marketing copy and product information, each checked straight away.'}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1" role="radiogroup" aria-label="How to write the German text">
            {(
              [
                { mode: 'sample', label: 'Sample', Icon: FileText, disabled: false },
                { mode: 'ai', label: 'Live AI', Icon: Cpu, disabled: !aiAvailable },
                { mode: 'local', label: 'Local', Icon: Languages, disabled: !localAvailable },
              ] as const
            ).map(({ mode, label, Icon, disabled }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={state.mode === mode}
                disabled={disabled}
                onClick={() => dispatch({ type: 'setMode', mode })}
                className={cx(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[13.5px] font-medium transition-colors',
                  state.mode === mode ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Icon size={14} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {state.mode === 'sample'
              ? 'Uses prewritten German for the example. Works offline, no model runs.'
              : state.mode === 'ai'
                ? `Writes the German with ${status?.model}. The checks are the same either way.`
                : `Translates supplied product text with ${status?.local.model ?? 'local Gemma + NLLB models'}. Marketing copy is not invented.`}
            {!aiAvailable && status && (HOSTED ? ' Live AI runs in the local version only.' : ' Live AI needs an API key on the server.')}
            {!localAvailable && !HOSTED && status && ' Local models need the translation service running on this computer.'}
            {HOSTED && state.mode === 'local' && ' Local models run in the local version only.'}
          </p>

          {state.productChangedSinceGeneration && (
            <p className="mt-4 flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> You changed the product. Generate again to update.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 flex gap-2 rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> {error}
            </p>
          )}

          <Button variant="primary" size="lg" className="mt-5 w-full" disabled={!ready || busy} onClick={generate}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {busy ? `Writing with ${state.mode === 'local' ? status?.local.model ?? 'local models' : status?.model ?? 'AI'}…` : 'Generate German content'}
          </Button>
          {!ready && <p className="mt-2 text-center text-[12.5px] text-muted">Add a name, size and at least one claim.</p>}
        </>
      )}
    </Card>
  );
}
