import { Compass, Languages, ScanSearch, Library, History, ArrowRight } from 'lucide-react';
import type { Route } from '../App';
import { useStore, isStale } from '../state/store';
import { segmentStatus } from '../domain/rules';
import { SAMPLE_COMPANY } from '../domain/sample';
import { cx } from './ui';

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
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#ffffff" fillOpacity="0.08" />
        <path d="M9 22V10h7.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="22" r="2.5" fill="#2FB9A4" />
      </svg>
      <span className="text-[16px] font-semibold tracking-tight text-white">ProofLingo</span>
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

      <div className="mx-2 mt-6 rounded-lg bg-white/[0.06] px-3 py-2.5">
        <div className="text-[13px] font-medium text-white">{SAMPLE_COMPANY.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/60">
          {SAMPLE_COMPANY.homeMarket} <ArrowRight size={11} aria-hidden /> {SAMPLE_COMPANY.destination}
        </div>
      </div>

      <ul className="mt-5 space-y-0.5">
        {NAV.map(({ route: r, label, Icon }) => {
          const active = r === route;
          return (
            <li key={r}>
              <a
                href={`#/${r}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium transition-colors',
                  active ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon size={16} strokeWidth={2} className={active ? 'text-[#5fd3c0]' : 'text-white/45'} aria-hidden />
                <span className="flex-1">{label}</span>
                {r === 'trustmap' && state.validation && (blocked > 0 || stale) && (
                  <span
                    className={cx('rounded-full px-1.5 text-[11px] font-semibold', stale ? 'bg-white/15 text-white' : 'bg-[#e5484d] text-white')}
                    title={stale ? 'Text changed since the last check' : `${blocked} blocked`}
                  >
                    {stale ? 'recheck' : blocked}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto px-2 text-[11px] leading-relaxed text-white/35">
        Decision support, not legal advice.
        <br />
        IEEE Hackathon · Track 2
      </div>
    </nav>
  );
}
