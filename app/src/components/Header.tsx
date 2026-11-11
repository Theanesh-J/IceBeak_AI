import { ArrowRight, Check, Cpu, FileText } from 'lucide-react';
import { navigate, useServer, type Route } from '../App';
import { SAMPLE_COMPANY } from '../domain/sample';
import { isStale, useStore } from '../state/store';
import { cx } from './ui';

const TITLES: Record<Route, { title: string; sub: string }> = {
  studio: { title: 'Prepare your next market', sub: 'Enter the product, choose a destination and generate German content.' },
  content: { title: 'Localised content', sub: 'Compare the English source with the German output, statement by statement.' },
  trustmap: { title: 'TrustMap', sub: 'Every statement, linked to the evidence that supports it, or to the evidence that is missing.' },
  sources: { title: 'Regulatory sources', sub: 'The curated EU texts the rule engine cites. Excerpts are kept separate from generated explanations.' },
  history: { title: 'Review history', sub: 'Every generation, check, decision and revision, with before-and-after text.' },
};

type StepState = 'done' | 'current' | 'todo';

function useWorkflow() {
  const { state } = useStore();
  const p = state.product;
  const productDone = !!p.name.trim() && p.claims.some((c) => c.trim());
  const localiseDone = !!state.content && !state.productChangedSinceGeneration;
  const verifyDone = !!state.validation && !isStale(state);
  const blocked = state.validation?.findings.filter((f) => f.status === 'blocked').length ?? 0;
  // Review is complete only when nothing is blocked and every open item has a reviewer decision.
  const openWithoutDecision =
    state.validation?.findings.filter((f) => f.status === 'review' && !state.decisions[f.id]).length ?? 0;
  const reviewDone = verifyDone && blocked === 0 && openWithoutDecision === 0;
  const steps: Array<{ key: string; label: string; route: Route; done: boolean }> = [
    { key: 'product', label: 'Product', route: 'studio', done: productDone },
    { key: 'localise', label: 'Localise', route: 'content', done: localiseDone },
    { key: 'verify', label: 'Verify', route: 'trustmap', done: verifyDone },
    { key: 'review', label: 'Review', route: 'trustmap', done: reviewDone },
  ];
  const firstOpen = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, state: (s.done ? 'done' : i === firstOpen ? 'current' : 'todo') as StepState }));
}

export function Workflow() {
  const steps = useWorkflow();
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Workflow progress">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(s.route)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors',
              s.state === 'done' && 'border-teal/30 bg-teal-soft text-teal-ink hover:bg-teal/15',
              s.state === 'current' && 'border-ink bg-ink text-white',
              s.state === 'todo' && 'border-line-2 bg-surface text-muted hover:text-ink',
            )}
            aria-label={`${s.label}: ${s.state === 'done' ? 'complete' : s.state === 'current' ? 'in progress' : 'not started'}`}
          >
            {s.state === 'done' ? (
              <Check size={13} strokeWidth={2.6} aria-hidden />
            ) : (
              <span className="text-[11px] tabular-nums opacity-70">{i + 1}</span>
            )}
            {s.label}
          </button>
          {i < steps.length - 1 && <ArrowRight size={13} className="text-line-2" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function ModeBadge() {
  const { state } = useStore();
  const { status } = useServer();
  const mode = state.content?.mode ?? state.mode;
  if (mode === 'ai') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-soft px-2.5 py-1 text-[12px] font-medium text-teal-ink">
        <Cpu size={13} aria-hidden /> Connected AI · {state.content?.model ?? status?.model}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2"
      title="Prewritten example content and deterministic checks. No model inference."
    >
      <FileText size={13} aria-hidden /> Sample scenario · no live model
    </span>
  );
}

export function Header({ route }: { route: Route }) {
  const t = TITLES[route];
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{t.title}</h1>
            <p className="mt-1 text-sm text-muted">{t.sub}</p>
          </div>
          <ModeBadge />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            <div className="flex gap-1.5">
              <dt className="text-muted">Company</dt>
              <dd className="font-medium">{SAMPLE_COMPANY.name}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Current market</dt>
              <dd className="font-medium">{SAMPLE_COMPANY.homeMarket}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Destination</dt>
              <dd className="font-medium">{SAMPLE_COMPANY.destination}</dd>
            </div>
          </dl>
          <Workflow />
        </div>
      </div>
    </header>
  );
}
