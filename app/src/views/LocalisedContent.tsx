import { useState, type KeyboardEvent } from 'react';
import { ArrowRight, Languages, ScanSearch, Eye, Columns2 } from 'lucide-react';
import { navigate } from '../App';
import type { DocType, Segment } from '../../../data/types';
import { segmentStatus } from '../../../trust/rules';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, StatusBadge, cx } from '../components/ui';
import { SAMPLE_COMPANY } from '../../../data/sample';

export const DOC_TABS: Array<{ key: DocType; label: string }> = [
  { key: 'listing', label: 'Product listing' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'info', label: 'Product information' },
];

const ORIGIN_LABEL: Record<Segment['origin'], string> = {
  sample: 'Prewritten sample text',
  model: 'Model output',
  deterministic: 'Composed from product facts',
  revision: 'Approved revision',
  manual: 'Edited by reviewer',
};

export function DocTabs({ value, onChange, counts }: { value: DocType; onChange: (d: DocType) => void; counts?: Partial<Record<DocType, number>> }) {
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = DOC_TABS[(i + (e.key === 'ArrowRight' ? 1 : DOC_TABS.length - 1)) % DOC_TABS.length];
    onChange(next.key);
    document.getElementById(`tab-${next.key}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Document" className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
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
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors',
            value === t.key ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {counts?.[t.key] ? (
            <span className="rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white" aria-label={`${counts[t.key]} blocking`}>
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
  const [open, setOpen] = useState<string | null>(null);

  if (!state.content) {
    return (
      <EmptyState
        icon={<Languages size={18} />}
        title="No localised content yet"
        body="Set up the product in Launch Studio and generate German content to compare it here."
        action={<Button variant="primary" onClick={() => navigate('studio')}>Go to Launch Studio</Button>}
      />
    );
  }

  const findings = state.validation?.findings ?? [];
  const segs = state.content.segments.filter((s) => s.docType === tab);
  const status = (id: string) => (state.validation ? segmentStatus(findings, id) : 'none');
  const blockedBy = (d: DocType) => state.content!.segments.filter((s) => s.docType === d && status(s.id) === 'blocked').length;

  const inspect = (id: string) => {
    dispatch({ type: 'select', segmentId: id });
    navigate('trustmap');
  };

  return (
    <div className="space-y-4">
      {isStale(state) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn-line bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          Content changed since the last check. Statuses below are from the previous check.
          <Button size="sm" onClick={() => navigate('trustmap')}>
            Open TrustMap to recheck
          </Button>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-2 sm:px-5">
          <DocTabs value={tab} onChange={setTab} counts={{ listing: blockedBy('listing'), marketing: blockedBy('marketing'), info: blockedBy('info') }} />
          {tab === 'listing' && (
            <div className="mb-2 flex rounded-md bg-canvas p-0.5" role="group" aria-label="Listing view">
              {(
                [
                  ['compare', 'Side by side', Columns2],
                  ['preview', 'Customer preview', Eye],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cx(
                    'flex items-center gap-1.5 rounded px-2.5 py-1 text-[12.5px] font-medium',
                    view === v ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon size={13} aria-hidden /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === 'listing' && view === 'preview' ? (
          <CustomerPreview segments={segs} status={status} onInspect={inspect} />
        ) : (
          <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
            <div className="hidden grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_130px] gap-4 border-b border-line bg-canvas/60 px-5 py-2 text-[11.5px] font-medium uppercase tracking-wide text-muted md:grid">
              <span>Field</span>
              <span>English original</span>
              <span>German localised</span>
              <span>Evidence status</span>
            </div>
            <ul className="divide-y divide-line">
              {segs.map((s) => {
                const st = status(s.id);
                const expanded = open === s.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setOpen(expanded ? null : s.id)}
                      aria-expanded={expanded}
                      className={cx(
                        'grid w-full gap-2 px-5 py-3.5 text-left transition-colors hover:bg-canvas/70 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_130px] md:gap-4',
                        expanded && 'bg-canvas/70',
                      )}
                    >
                      <span className="text-[12.5px] font-medium text-muted">{s.field}</span>
                      <span lang="en" className="text-[14px] leading-relaxed text-ink-2">
                        <span className="mr-1.5 text-[11px] font-semibold text-muted md:hidden">EN</span>
                        {s.en}
                      </span>
                      <span lang="de" className={cx('text-[14px] leading-relaxed', s.untranslated ? 'italic text-muted' : 'text-ink')}>
                        <span className="mr-1.5 text-[11px] font-semibold text-muted md:hidden">DE</span>
                        {s.de}
                      </span>
                      <span>
                        <StatusBadge status={st} />
                      </span>
                    </button>
                    {expanded && (
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas/70 px-5 pb-4 text-[12.5px] text-muted fade-in md:pl-[186px]">
                        <span>
                          Source: <span className="text-ink-2">{ORIGIN_LABEL[s.origin]}</span> · {s.en.length} → {s.de.length} characters
                          {state.validation && ` · ${findings.filter((f) => f.segmentId === s.id).length} finding(s)`}
                        </span>
                        <Button size="sm" onClick={() => inspect(s.id)}>
                          <ScanSearch size={14} aria-hidden /> Inspect in TrustMap
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
              {segs.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">No statements in this document.</li>}
            </ul>
          </div>
        )}
      </Card>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => navigate('trustmap')}>
          Continue to TrustMap <ArrowRight size={15} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function CustomerPreview({
  segments,
  status,
  onInspect,
}: {
  segments: Segment[];
  status: (id: string) => ReturnType<typeof segmentStatus>;
  onInspect: (id: string) => void;
}) {
  const [overlay, setOverlay] = useState(true);
  const { state } = useStore();
  const title = segments.find((s) => s.id === 'ls-title');
  const desc = segments.find((s) => s.id === 'ls-desc');
  const benefits = segments.filter((s) => s.id.startsWith('ls-claim-'));
  const size = segments.find((s) => s.id === 'ls-size');
  const inci = state.content?.segments.find((s) => s.id === 'pi-inci');


  return (
    <div role="tabpanel" aria-labelledby="tab-listing" className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
        <span>Preview of the German listing as a customer would read it. Select any statement to inspect it.</span>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="accent-teal" />
          TrustMap overlay
        </label>
      </div>
      <div lang="de" className="mx-auto grid max-w-4xl gap-8 rounded-xl border border-line bg-white p-5 sm:p-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex aspect-square items-center justify-center rounded-lg bg-[#eef1ee]">
          <div className="flex flex-col items-center">
            <div className="h-6 w-28 rounded-t-md bg-[#c9d3cf]" />
            <div className="flex h-24 w-36 flex-col items-center justify-center rounded-b-2xl rounded-t-sm bg-white shadow-sm ring-1 ring-black/5">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-ink">NORTHFIELD</span>
              <span className="mt-1 text-[9px] text-muted">{size?.de}</span>
            </div>
            <span className="mt-4 text-[11px] text-muted">Produktabbildung folgt</span>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-medium uppercase tracking-wider text-teal">{SAMPLE_COMPANY.name}</div>
          <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-ink sm:text-[22px]">
            <Statement overlay={overlay} status={status} onInspect={onInspect} s={title} />
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            <Statement overlay={overlay} status={status} onInspect={onInspect} s={desc} />
          </p>
          <ul className="mt-5 space-y-2.5">
            {benefits.map((b) => (
              <li key={b.id} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
                <Statement overlay={overlay} status={status} onInspect={onInspect} s={b} />
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[13px]">
            <dt className="text-muted">Inhalt</dt>
            <dd>
              <Statement overlay={overlay} status={status} onInspect={onInspect} s={size} />
            </dd>
          </dl>
          {inci && (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer font-medium text-ink-2">Inhaltsstoffe</summary>
              <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-muted">{inci.de.replace(/^Inhaltsstoffe:\s*/, '')}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function Statement({
  s,
  className,
  overlay,
  status,
  onInspect,
}: {
  s?: Segment;
  className?: string;
  overlay: boolean;
  status: (id: string) => ReturnType<typeof segmentStatus>;
  onInspect: (id: string) => void;
}) {
  if (!s) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => onInspect(s.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onInspect(s.id)}
      className={cx(overlay ? `hl hl-${status(s.id)}` : 'cursor-pointer', className)}
      title="Inspect in TrustMap"
    >
      {s.de}
    </span>
  );
}
