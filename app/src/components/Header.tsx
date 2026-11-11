import { Cpu, FileText } from 'lucide-react';
import { useServer, type Route } from '../App';
import { useStore } from '../state/store';

const TITLES: Record<Route, string> = {
  studio: 'Prepare your next market',
  content: 'Review',
  trustmap: 'Review',
  sources: 'Sources',
  history: 'History',
};

export function ModeBadge() {
  const { state } = useStore();
  const { status } = useServer();
  const mode = state.content?.mode ?? state.mode;
  return mode === 'ai' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-0.5 text-[12px] font-medium text-teal-ink" title="Text written by a live model">
      <Cpu size={12} aria-hidden /> Live AI · {state.content?.model ?? status?.model}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-0.5 text-[12px] font-medium text-muted" title="Prewritten example text. No model is running.">
      <FileText size={12} aria-hidden /> Sample mode
    </span>
  );
}

export function Header({ route }: { route: Route }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">{TITLES[route]}</h1>
        <ModeBadge />
      </div>
    </header>
  );
}
