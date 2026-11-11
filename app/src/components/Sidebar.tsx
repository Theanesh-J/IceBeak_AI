import { Compass, Languages, ScanSearch, Library, History } from 'lucide-react';
import type { Route } from '../App';
import { useStore, isStale } from '../state/store';
import { cx } from './ui';
import { segmentStatus } from '../domain/rules';

const NAV: Array<{ route: Route; label: string; Icon: typeof Compass }> = [
  { route: 'studio', label: 'Launch Studio', Icon: Compass },
  { route: 'content', label: 'Localised Content', Icon: Languages },
  { route: 'trustmap', label: 'TrustMap', Icon: ScanSearch },
  { route: 'sources', label: 'Regulatory Sources', Icon: Library },
  { route: 'history', label: 'Review History', Icon: History },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#ffffff" fillOpacity="0.08" />
        <path d="M9 22V10h7.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="22" r="2.5" fill="#2FB9A4" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-white">ProofLingo</div>
        <div className="text-[11px] text-white/50">Go global. Know what to trust.</div>
      </div>
    </div>
  );
}

export function Sidebar({ route }: { route: Route }) {
  const { state } = useStore();
  const blocked =
    state.validation && state.content ? state.content.segments.filter((s) => segmentStatus(state.validation!.findings, s.id) === 'blocked').length : 0;
  const stale = isStale(state);

  return (
    <nav className="flex h-full flex-col bg-navy px-3 py-5 text-white/80" aria-label="Main">
      <div className="px-2">
        <Logo />
      </div>

      <div className="mt-8 px-2 text-[11px] font-medium uppercase tracking-wider text-white/40">Workspace</div>
      <ul className="mt-2 space-y-0.5">
        {NAV.map(({ route: r, label, Icon }) => {
          const active = r === route;
          return (
            <li key={r}>
              <a
                href={`#/${r}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                  active ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon size={16} strokeWidth={2} className={active ? 'text-[#5fd3c0]' : 'text-white/50'} aria-hidden />
                <span className="flex-1">{label}</span>
                {r === 'trustmap' && state.validation && (blocked > 0 || stale) && (
                  <span
                    className={cx(
                      'rounded-full px-1.5 text-[11px] font-semibold',
                      stale ? 'bg-white/15 text-white' : 'bg-[#e5484d] text-white',
                    )}
                    title={stale ? 'Content changed since last check' : `${blocked} blocked statements`}
                  >
                    {stale ? 'recheck' : blocked}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-3 px-2">
        <div className="rounded-lg border border-white/10 p-3 text-[12px] leading-relaxed text-white/60">
          Statuses show how far the evidence you provided covers each statement. They are not legal approval.
        </div>
        <div className="text-[11px] text-white/35">IEEE Hackathon · Track 2 demo</div>
      </div>
    </nav>
  );
}
