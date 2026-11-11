import { useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronRight, Columns2, Eye, Languages } from 'lucide-react';
import { navigate } from '../App';
import type { DocType, Segment } from '../../../data/types';
import { segmentStatus } from '../../../trust/rules';
import { SAMPLE_COMPANY } from '../../../data/sample';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, STATUS_META, cx } from '../components/ui';

export const DOC_TABS: Array<{ key: DocType; label: string }> = [
  { key: 'listing', label: 'Listing' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'info', label: 'Product info' },
];

/** Pill-style document switcher. Counts show how many sentences must be fixed. */
export function DocTabs({ value, onChange, counts }: { value: DocType; onChange: (d: DocType) => void; counts?: Partial<Record<DocType, number>> }) {
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = DOC_TABS[(i + (e.key === 'ArrowRight' ? 1 : DOC_TABS.length - 1)) % DOC_TABS.length];
    onChange(next.key);
    document.getElementById(`tab-${next.key}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Document" className="my-2 inline-flex max-w-full overflow-x-auto rounded-xl bg-fill p-1 [scrollbar-width:none]">
      {DOC_TABS.map((t, i) => (
        <button
          key={t.key}
          id={`tab-${t.key}`}
          role="tab"
          aria-selected={value === t.key}
          tabIndex={value === t.key ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(t.key)}
          className={cx(
            'flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition-colors',
            value === t.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {t.label}
          {counts?.[t.key] ? (
            <span className="rounded-full bg-bad-dot px-1.5 text-[11.5px] font-semibold text-white" aria-label={`${counts[t.key]} to fix`}>
              {counts[t.key]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function LocalisedContentView() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<DocType>('listing');
  const [view, setView] = useState<'compare' | 'preview'>('compare');

  if (!state.content) {
    return (
      <EmptyState
        icon={<Languages size={18} />}
        title="No German content yet"
        body="Set up your product in Launch Studio and create the German version to compare it here."
        action={
          <Button variant="primary" onClick={() => navigate('studio')}>
            Go to Launch Studio
          </Button>
        }
      />
    );
  }

  const findings = state.validation?.findings ?? [];
  const status = (id: string) => (state.validation ? segmentStatus(findings, id) : 'none');
  const all = state.content.segments;
  const segs = all.filter((s) => s.docType === tab);
  const toFix = (d: DocType) => all.filter((s) => s.docType === d && status(s.id) === 'blocked').length;
  const inspect = (id: string) => {
    dispatch({ type: 'select', segmentId: id });
    navigate('trustmap');
  };
  const showPreview = tab === 'listing' && view === 'preview';

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-6 sm:p-7">
        <p className="text-[14px] font-medium text-muted">Your German content</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
            {all.length} sentences in 3 documents
          </h2>
          <Button variant="primary" size="lg" onClick={() => navigate('trustmap')}>
            Review and fix <ArrowRight size={17} aria-hidden />
          </Button>
        </div>
        <p className="mt-2 text-[15px] text-ink-2">
          {state.content.mode === 'ai' ? `Written by ${state.content.model}.` : 'Prewritten example text, no model involved.'} Regulatory lines come from your product facts.
        </p>
        {isStale(state) && (
          <p className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn">Some text changed since the last check, so the labels below may be out of date.</p>
        )}
      </Card>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DocTabs value={tab} onChange={setTab} counts={{ listing: toFix('listing'), marketing: toFix('marketing'), info: toFix('info') }} />
        {tab === 'listing' && (
          <div className="inline-flex rounded-xl bg-fill p-1" role="group" aria-label="View">
            {(
              [
                ['compare', 'Compare', Columns2],
                ['preview', 'Shop preview', Eye],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cx(
                  'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition-colors',
                  view === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showPreview ? (
        <ShopPreview segments={segs} status={status} onInspect={inspect} inci={all.find((s) => s.id === 'pi-inci')?.de} />
      ) : (
        <Card className="overflow-hidden" >
          <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] gap-6 border-b border-line px-6 py-3 text-[12.5px] font-medium text-muted md:grid">
              <span>English · what you wrote</span>
              <span>German · what customers read</span>
              <span />
            </div>
            <ul>
              {segs.map((s, i) => (
                <Row key={s.id} seg={s} status={status(s.id)} first={i === 0} onOpen={() => inspect(s.id)} />
              ))}
              {segs.length === 0 && <li className="px-6 py-12 text-center text-[14px] text-muted">Nothing in this document.</li>}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ seg, status, first, onOpen }: { seg: Segment; status: ReturnType<typeof segmentStatus>; first: boolean; onOpen: () => void }) {
  const m = STATUS_META[status];
  return (
    <li className={cx(!first && 'border-t border-line')}>
      <button onClick={onOpen} className="group grid w-full gap-3 px-6 py-5 text-left transition-colors hover:bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] md:gap-6">
        <div className="flex items-center justify-between gap-3 md:col-span-3">
          <span className="text-[13px] font-medium text-muted">{seg.field}</span>
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold', m.soft)}>
            <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} aria-hidden />
            {m.short}
          </span>
        </div>
        <p lang="en" className="text-[15px] leading-relaxed text-ink-2">
          <span className="mr-2 text-[11.5px] font-semibold text-muted md:hidden">EN</span>
          {seg.en}
        </p>
        <p lang="de" className={cx('text-[15.5px] font-medium leading-relaxed', seg.untranslated ? 'italic text-muted' : 'text-ink')}>
          <span className="mr-2 text-[11.5px] font-semibold text-muted md:hidden">DE</span>
          {seg.de}
        </p>
        <ChevronRight size={18} className="hidden self-center text-muted transition-transform group-hover:translate-x-0.5 md:block" aria-hidden />
      </button>
    </li>
  );
}

function Statement({ s, overlay, status, onInspect }: { s?: Segment; overlay: boolean; status: (id: string) => ReturnType<typeof segmentStatus>; onInspect: (id: string) => void }) {
  if (!s) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => onInspect(s.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInspect(s.id)}
      className={overlay ? `hl hl-${status(s.id)}` : 'cursor-pointer'}
      title="Open in TrustMap"
    >
      {s.de}
    </span>
  );
}

function ShopPreview({
  segments,
  status,
  onInspect,
  inci,
}: {
  segments: Segment[];
  status: (id: string) => ReturnType<typeof segmentStatus>;
  onInspect: (id: string) => void;
  inci?: string;
}) {
  const [overlay, setOverlay] = useState(true);
  const title = segments.find((s) => s.id === 'ls-title');
  const desc = segments.find((s) => s.id === 'ls-desc');
  const benefits = segments.filter((s) => s.id.startsWith('ls-claim-'));
  const size = segments.find((s) => s.id === 'ls-size');
  const p = { overlay, status, onInspect };

  return (
    <Card className="p-5 sm:p-8" >
      <div role="tabpanel" aria-labelledby="tab-listing">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-muted">How the German listing looks to a customer. Tap any line to check it.</p>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium text-ink">
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
              <span className="h-6 w-10 rounded-full bg-fill-2 transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-teal" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
            Show check colours
          </label>
        </div>

        <div lang="de" className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10">
          <div className="flex aspect-square items-center justify-center rounded-2xl bg-fill">
            <div className="flex flex-col items-center">
              <div className="h-6 w-28 rounded-t-md bg-fill-2" />
              <div className="flex h-24 w-36 flex-col items-center justify-center rounded-b-2xl rounded-t-sm bg-white shadow-sm ring-1 ring-black/5">
                <span className="text-[10px] font-semibold tracking-[0.2em] text-ink">NORTHFIELD</span>
                <span className="mt-1 text-[9px] text-muted">{size?.de}</span>
              </div>
              <span className="mt-4 text-[12px] text-muted">Produktbild folgt</span>
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-muted">{SAMPLE_COMPANY.name}</div>
            <h3 className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-ink">
              <Statement s={title} {...p} />
            </h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
              <Statement s={desc} {...p} />
            </p>
            <ul className="mt-6 space-y-3">
              {benefits.map((b) => (
                <li key={b.id} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />
                  <Statement s={b} {...p} />
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between rounded-xl bg-fill px-4 py-3 text-[14px]">
              <span className="text-muted">Inhalt</span>
              <span className="font-semibold">
                <Statement s={size} {...p} />
              </span>
            </div>
            {inci && (
              <details className="mt-3 rounded-xl border border-line px-4 py-3 text-[14px]">
                <summary className="cursor-pointer font-semibold text-ink">Inhaltsstoffe</summary>
                <p className="mt-2 font-mono text-[12px] leading-relaxed text-muted">{inci.replace(/^Inhaltsstoffe:\s*/, '')}</p>
              </details>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
