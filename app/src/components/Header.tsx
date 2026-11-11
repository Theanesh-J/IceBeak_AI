import { Check, Cpu, FileText } from 'lucide-react';
import { navigate, useServer, type Route } from '../App';
import { isStale, useStore } from '../state/store';
import { cx } from './ui';

const TITLES: Record<Route, string> = {
  studio: 'Prepare your next market',
  content: 'Localised content',
  trustmap: 'TrustMap',
  sources: 'Regulatory sources',
  history: 'Review history',
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
  const openWithoutDecision = state.validation?.findings.filter((f) => f.status === 'review' && !state.decisions[f.id]).length ?? 0;
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
    <ol className="flex items-center" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center">
          <button
            onClick={() => navigate(s.route)}
            className="group flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium"
            aria-label={`${s.label}: ${s.state === 'done' ? 'complete' : s.state === 'current' ? 'current step' : 'not started'}`}
          >
            <span
              className={cx(
                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                s.state === 'done' && 'bg-teal text-white',
                s.state === 'current' && 'bg-ink text-white',
                s.state === 'todo' && 'border border-line-2 text-muted',
              )}
            >
              {s.state === 'done' ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={cx(s.state === 'todo' ? 'text-muted' : 'text-ink', 'group-hover:text-ink', s.state !== 'current' && 'hidden sm:inline')}>{s.label}</span>
          </button>
          {i < steps.length - 1 && <span className={cx('mx-1 h-px w-3 sm:w-7', s.done ? 'bg-teal' : 'bg-line-2')} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function ModeBadge() {
  const { state } = useStore();
  const { status } = useServer();
  const mode = state.content?.mode ?? state.mode;
  return mode === 'ai' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-0.5 text-[12px] font-medium text-teal-ink" title="Text written by a live model">
      <Cpu size={12} aria-hidden /> Live AI · {state.content?.model ?? status?.model}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-0.5 text-[12px] font-medium text-muted ring-1 ring-line" title="Prewritten example text. No model is running.">
      <FileText size={12} aria-hidden /> Sample mode
    </span>
  );
}

export function Header({ route }: { route: Route }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">{TITLES[route]}</h1>
          <ModeBadge />
        </div>
        <Workflow />
      </div>
    </header>
  );
}
