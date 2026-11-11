import { Compass, ScanSearch, Library, History, ArrowRight } from 'lucide-react';
import type { Route } from '../App';
import { useStore, isStale } from '../state/store';
import { segmentStatus } from '../../../trust/rules';
import { SAMPLE_COMPANY } from '../../../data/sample';
import { cx } from './ui';

const NAV: Array<{ route: Route; label: string; Icon: typeof Compass; also?: Route[] }> = [
  { route: 'studio', label: 'Your product', Icon: Compass },
  { route: 'trustmap', label: 'Review', Icon: ScanSearch, also: ['content'] },
  { route: 'sources', label: 'Sources', Icon: Library },
  { route: 'history', label: 'History', Icon: History },
];

const GROUPS: Array<[string, typeof NAV]> = [
  ['Launch', NAV.slice(0, 2)],
  ['Reference', NAV.slice(2)],
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#111318" />
        <path d="M9 22V10h7.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="22" r="2.5" fill="#17b26a" />
      </svg>
      <span className="text-[16px] font-semibold tracking-tight text-ink">ProofLingo</span>
    </div>
  );
}

export function Sidebar({ route }: { route: Route }) {
  const { state } = useStore();
  const blocked =
    state.validation && state.content ? state.content.segments.filter((s) => segmentStatus(state.validation!.findings, s.id) === 'blocked').length : 0;
  const stale = isStale(state);

  return (
    <nav className="flex h-full flex-col border-r border-line bg-surface px-3 py-5" aria-label="Main">
      <div className="px-2">
        <Logo />
      </div>

      <div className="mx-1 mt-6 rounded-xl bg-fill px-3 py-2.5">
        <div className="text-[13px] font-semibold text-ink">{SAMPLE_COMPANY.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
          {SAMPLE_COMPANY.homeMarket} <ArrowRight size={11} aria-hidden /> {SAMPLE_COMPANY.destination}
        </div>
      </div>

      {GROUPS.map(([group, items]) => (
        <div key={group} className="mt-6">
          <div className="px-3 text-[11.5px] font-medium text-muted">{group}</div>
          <ul className="mt-1.5 space-y-0.5">
            {items.map(({ route: r, label, Icon, also }) => {
              const active = r === route || !!also?.includes(route);
              return (
                <li key={r}>
                  <a
                    href={`#${r}`}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                      active ? 'bg-fill font-semibold text-ink' : 'text-ink-2 hover:bg-fill/70 hover:text-ink',
                    )}
                  >
                    <Icon size={17} strokeWidth={2} className={active ? 'text-ink' : 'text-muted'} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {r === 'trustmap' && state.validation && (blocked > 0 || stale) && (
                      <span
                        className={cx('rounded-full px-2 py-px text-[11.5px] font-semibold', stale ? 'bg-fill-2 text-ink-2' : 'bg-bad-dot text-white')}
                        title={stale ? 'Text changed since the last check' : `${blocked} to fix`}
                      >
                        {stale ? 'recheck' : blocked}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto px-3 text-[11.5px] leading-relaxed text-muted">
        Decision support, not legal advice.
        <br />
        IEEE Hackathon · Track 2
      </div>
    </nav>
  );
}
