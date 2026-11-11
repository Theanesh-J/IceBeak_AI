import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Cpu,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  RefreshCw,
  ScanSearch,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { navigate, useServer } from '../App';
import type { DocType, EvidenceStatus, Finding, Segment } from '../../../data/types';
import { STATUS_RANK, segmentStatus, summarise } from '../../../trust/rules';
import { getProvision } from '../../../regulatory/sources';
import { sampleRevisionFor } from '../../../localise/compose';
import { reviseWithAI } from '../lib/api';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, STATUS_META, cx, formatTime, inputCls } from '../components/ui';
import { DocTabs } from './LocalisedContent';
import { kindLabel } from './LaunchStudio';

const DOC_NAME: Record<DocType, string> = { listing: 'Listing', marketing: 'Marketing', info: 'Product info' };
const GROUP_HINT: Record<EvidenceStatus, string> = {
  blocked: 'These can’t be published as they are.',
  review: 'Your evidence doesn’t settle these. Ask a specialist, or change the wording.',
  supported: 'Your evidence covers these sentences.',
};

type Seg = Segment & { status: EvidenceStatus | 'none'; top?: Finding };

function useSegments(): Seg[] {
  const { state } = useStore();
  return useMemo(() => {
    if (!state.content || !state.validation) return [];
    const f = state.validation.findings;
    return state.content.segments.map((s) => {
      const mine = f.filter((x) => x.segmentId === s.id).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
      return { ...s, status: segmentStatus(f, s.id), top: mine[0] };
    });
  }, [state.content, state.validation]);
}

export function TrustMapView() {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<'list' | 'doc'>('list');
  const segs = useSegments();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'select', segmentId: undefined });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  if (!state.content || !state.validation) {
    return (
      <EmptyState
        icon={<ScanSearch size={18} />}
        title="Nothing to review yet"
        body="Create the German content first. Every sentence is checked as soon as it’s written."
        action={
          <Button variant="primary" onClick={() => navigate('studio')}>
            Go to Launch Studio
          </Button>
        }
      />
    );
  }

  const selected = segs.find((s) => s.id === state.selectedSegmentId);
  const select = (id?: string) => dispatch({ type: 'select', segmentId: id });
  const queue = [...segs.filter((s) => s.status === 'blocked'), ...segs.filter((s) => s.status === 'review')];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
      <div className="min-w-0 space-y-6">
        <Summary segs={segs} onNext={queue[0] ? () => select(queue[0].id) : undefined} />

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-[#eef0ec] p-1" role="tablist" aria-label="View">
            {(
              [
                ['list', 'To-do list', ListChecks],
                ['doc', 'Full document', FileText],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cx(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors',
                  view === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
          {isStale(state) && (
            <Button size="sm" onClick={() => dispatch({ type: 'runValidation' })}>
              <RefreshCw size={14} aria-hidden /> Check again
            </Button>
          )}
        </div>

        {view === 'list' ? <TodoList segs={segs} selectedId={selected?.id} onSelect={select} /> : <DocumentView segs={segs} selectedId={selected?.id} onSelect={select} />}
      </div>

      {/* Detail: right column on desktop, bottom sheet on phones */}
      {selected ? (
        <>
          <div className="fixed inset-0 z-30 bg-navy/40 fade-in lg:hidden" onClick={() => select(undefined)} aria-hidden />
          <aside
            aria-label="Sentence details"
            className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sheet-in lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:max-h-[calc(100vh-3rem)] lg:self-start lg:rounded-2xl lg:border lg:border-line/80 lg:shadow-[0_1px_2px_rgba(23,33,43,0.04)]"
          >
            <Detail key={selected.id + state.contentVersion} seg={selected} queue={queue} onSelect={select} />
          </aside>
        </>
      ) : (
        <div className="hidden lg:block">
          <Card className="sticky top-6 p-6">
            <h2 className="text-[17px] font-semibold">Pick an item to see the details</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">For each sentence you’ll see what’s wrong, what evidence is missing, and a fix you can apply in one click.</p>
            <ul className="mt-6 space-y-4">
              {(['blocked', 'review', 'supported'] as const).map((s) => {
                const m = STATUS_META[s];
                return (
                  <li key={s} className="flex items-start gap-3">
                    <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', m.soft)}>
                      <m.Icon size={17} aria-hidden />
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold text-ink">{m.short}</span>
                      <span className="block text-[13px] text-muted">{GROUP_HINT[s]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
              Statuses show how far your evidence covers each sentence. They aren’t legal approval.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- Summary ---------- */

function Summary({ segs, onNext }: { segs: Seg[]; onNext?: () => void }) {
  const { state } = useStore();
  const counts = summarise(state.validation!.findings, state.content!.segments);
  const total = segs.length;
  const d = state.lastDiff;
  const bar: Array<[EvidenceStatus | 'none', number]> = [
    ['supported', counts.supported],
    ['none', counts.none],
    ['review', counts.review],
    ['blocked', counts.blocked],
  ];
  const nextIsBlocked = counts.blocked > 0;

  return (
    <Card className="p-6 sm:p-7">
      <p className="text-[14px] font-medium text-muted">Before you launch in Germany</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          {counts.blocked > 0 ? (
            <h2 className="flex items-baseline gap-3 text-ink">
              <span className="text-[52px] font-semibold leading-none tracking-tight tabular-nums text-bad">{counts.blocked}</span>
              <span className="text-[22px] font-semibold tracking-tight">{counts.blocked === 1 ? 'sentence to fix' : 'sentences to fix'}</span>
            </h2>
          ) : (
            <h2 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight text-ink">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Check size={24} strokeWidth={2.6} aria-hidden />
              </span>
              Nothing to fix
            </h2>
          )}
          <p className="mt-3 text-[15px] text-ink-2">
            {counts.review} {counts.review === 1 ? 'needs' : 'need'} an expert · {counts.supported} backed by your evidence
          </p>
        </div>
        {onNext && (
          <Button variant="primary" size="lg" onClick={onNext}>
            {nextIsBlocked ? 'Fix next' : 'Review next'} <ArrowRight size={17} aria-hidden />
          </Button>
        )}
      </div>

      <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${counts.supported} of ${total} sentences backed by evidence, ${counts.review} need an expert, ${counts.blocked} must be fixed`}>
        {bar.map(([s, n]) => (n ? <span key={s} className={cx('h-full transition-all duration-500', STATUS_META[s].dot)} style={{ width: `${(n / total) * 100}%` }} /> : null))}
      </div>
      <div className="mt-2 flex justify-between text-[12.5px] text-muted">
        <span>{total} sentences checked</span>
        <span>Checked {formatTime(state.validation!.ranAt)}</span>
      </div>

      {d && d.resolved.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-ok-soft px-4 py-3 fade-in" role="status">
          <CircleCheck size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden />
          <p className="text-[14px] text-ink">
            <span className="font-semibold">Checked again: {d.resolved.length} problem{d.resolved.length === 1 ? '' : 's'} fixed.</span>
            {d.added.length > 0 && <span className="font-semibold text-bad"> {d.added.length} new.</span>}{' '}
            <span className="text-ink-2">Fixed means the check passes. It isn’t legal approval.</span>
          </p>
        </div>
      )}
    </Card>
  );
}

/* ---------- To-do list ---------- */

function TodoList({ segs, selectedId, onSelect }: { segs: Seg[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [showOk, setShowOk] = useState(false);
  const groups = (['blocked', 'review', 'supported'] as const).map((s) => [s, segs.filter((x) => x.status === s)] as const);
  const none = segs.filter((s) => s.status === 'none').length;

  return (
    <div className="space-y-8">
      {groups.map(([status, items]) => {
        if (!items.length) return null;
        const m = STATUS_META[status];
        const collapsed = status === 'supported' && !showOk;
        return (
          <section key={status} aria-labelledby={`grp-${status}`}>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h3 id={`grp-${status}`} className="flex items-center gap-2 text-[16px] font-semibold text-ink">
                  <span className={cx('h-2.5 w-2.5 rounded-full', m.dot)} aria-hidden /> {m.short}
                  <span className="text-muted tabular-nums">{items.length}</span>
                </h3>
                <p className="mt-0.5 text-[13.5px] text-muted">{GROUP_HINT[status]}</p>
              </div>
              {status === 'supported' && (
                <button onClick={() => setShowOk(!showOk)} className="shrink-0 text-[13.5px] font-semibold text-teal hover:underline" aria-expanded={!collapsed}>
                  {collapsed ? 'Show' : 'Hide'}
                </button>
              )}
            </div>
            {!collapsed && (
              <ul className="overflow-hidden rounded-2xl border border-line/80 bg-surface shadow-[0_1px_2px_rgba(23,33,43,0.04)]">
                {items.map((s, i) => (
                  <li key={s.id} className={cx(i > 0 && 'border-t border-line')}>
                    <button
                      onClick={() => onSelect(s.id)}
                      aria-current={selectedId === s.id ? 'true' : undefined}
                      className={cx(
                        'flex w-full items-center gap-4 px-4 py-4 text-left transition-colors sm:px-5',
                        selectedId === s.id ? 'bg-teal-soft/70' : 'hover:bg-canvas',
                      )}
                    >
                      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', m.soft)}>
                        <m.Icon size={19} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span lang="de" className="line-clamp-2 block text-[15px] font-medium leading-snug text-ink">
                          {s.de}
                        </span>
                        <span className="mt-1 block truncate text-[13px] text-muted">
                          {status === 'supported' ? DOC_NAME[s.docType] + ' · ' + s.field : s.top?.title}
                          {status !== 'supported' && <span className="hidden sm:inline"> · {DOC_NAME[s.docType]}</span>}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {none > 0 && <p className="px-1 text-[13px] text-muted">{none} more sentences make no claim, so there’s nothing to check. See them in Full document.</p>}
    </div>
  );
}

/* ---------- Full document (highlighted) ---------- */

function DocumentView({ segs, selectedId, onSelect }: { segs: Seg[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [tab, setTab] = useState<DocType>(() => segs.find((s) => s.id === selectedId)?.docType ?? 'listing');
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const blockedIn = (d: DocType) => segs.filter((s) => s.docType === d && s.status === 'blocked').length;
  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-2 sm:px-5">
        <DocTabs value={tab} onChange={setTab} counts={{ listing: blockedIn('listing'), marketing: blockedIn('marketing'), info: blockedIn('info') }} />
        <div className="mb-2 flex rounded-lg bg-canvas p-0.5 text-[13px]" role="group" aria-label="Language">
          {(['de', 'en'] as const).map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={cx('rounded-md px-2.5 py-1 font-semibold', lang === l ? 'bg-surface shadow-sm' : 'text-muted')}>
              {l === 'de' ? 'German' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" aria-labelledby={`tab-${tab}`} lang={lang} className="border-t border-line p-4 sm:p-6">
        {segs
          .filter((s) => s.docType === tab)
          .map((s) => (
            <div key={s.id} className="grid gap-1 py-2.5 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-5">
              <span className="pt-1 text-[13px] text-muted">{s.field}</span>
              <p className="text-[16px] leading-[1.75] text-ink">
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.field}: ${STATUS_META[s.status].short}`}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(s.id))}
                  className={cx(s.status === 'none' ? 'hl hl-none' : `hl hl-${s.status}`, selectedId === s.id && 'hl-selected')}
                >
                  {lang === 'de' ? s.de : s.en}
                </span>
              </p>
            </div>
          ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-[12.5px] text-muted">
        {(['blocked', 'review', 'supported'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cx('hl inline-block h-3 w-5', `hl-${s}`)} aria-hidden /> {STATUS_META[s].short}
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Detail ---------- */

function mark(text: string, triggers: string[]): ReactNode {
  const t = triggers.filter((x) => x && text.toLowerCase().includes(x.toLowerCase()));
  if (!t.length) return text;
  const re = new RegExp(`(${t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((p, i) =>
    i % 2 ? (
      <mark key={i} className="rounded bg-[#ffe08a] px-0.5 text-ink">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

function Detail({ seg, queue, onSelect }: { seg: Seg; queue: Seg[]; onSelect: (id?: string) => void }) {
  const { state, dispatch } = useStore();
  const { status: server } = useServer();
  const all = state.validation!.findings;
  const findings = all.filter((f) => f.segmentId === seg.id).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const open = findings.filter((f) => f.status !== 'supported');
  const st = seg.status;
  const m = STATUS_META[st];
  const missing = [...new Set(open.flatMap((f) => f.missing))];
  const evidence = state.product.evidence.filter((e) => findings.some((f) => f.evidenceUsed.includes(e.id)));
  const refs = [...new Map(findings.flatMap((f) => f.sourceRefs).map((r) => [r.sourceId + r.provisionId, r])).values()];
  const gap = findings.some((f) => f.sourceGap);
  const justFixed = !!state.lastDiff?.resolved.some((f) => f.segmentId === seg.id) && (seg.origin === 'revision' || seg.origin === 'manual');
  const escalated = open.length > 0 && open.every((f) => state.decisions[f.id]?.decision === 'escalated');
  const next = queue.find((s) => s.id !== seg.id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ en: seg.en, de: seg.de });
  const [aiFix, setAiFix] = useState<{ en: string; de: string; rationale: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const fix = aiFix ?? (open.length ? sampleRevisionFor(seg) : undefined);
  const linked = useMemo(
    () =>
      seg.claimRef && fix
        ? state.content!.segments.filter((s) => s.id !== seg.id && s.claimRef === seg.claimRef && segmentStatus(all, s.id) === 'blocked' && sampleRevisionFor(s))
        : [],
    [seg, fix, state.content, all],
  );
  const [applyLinked, setApplyLinked] = useState(true);

  const apply = () => {
    if (!fix) return;
    const edits = [{ segmentId: seg.id, en: fix.en, de: fix.de }];
    const ids = open.map((f) => f.id);
    if (applyLinked)
      for (const s of linked) {
        const r = sampleRevisionFor(s)!;
        edits.push({ segmentId: s.id, en: r.en, de: r.de });
        ids.push(...all.filter((f) => f.segmentId === s.id && f.status !== 'supported').map((f) => f.id));
      }
    dispatch({ type: 'reviseSegments', edits, decision: 'revision-applied', findingIds: ids, note: fix.rationale });
  };

  const askAI = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      setAiFix(await reviseWithAI(state.product, seg, open));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not suggest a fix.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="fade-in">
      {/* Grab handle on phones */}
      <div className="flex justify-center pt-3 lg:hidden" aria-hidden>
        <span className="h-1.5 w-10 rounded-full bg-line-2" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <div className="flex items-center gap-3">
          <span className={cx('flex h-11 w-11 items-center justify-center rounded-full', m.soft)}>
            <m.Icon size={22} aria-hidden />
          </span>
          <div>
            <div className="text-[17px] font-semibold text-ink">{justFixed ? 'Fixed' : m.short}</div>
            <div className="text-[13px] text-muted">
              {DOC_NAME[seg.docType]} · {seg.field}
            </div>
          </div>
        </div>
        <button onClick={() => onSelect(undefined)} className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink" aria-label="Close">
          <X size={18} aria-hidden />
        </button>
      </div>

      {/* Sentence */}
      <div className="mx-6 mt-5 rounded-2xl bg-canvas p-4">
        <p lang="de" className="text-[18px] font-semibold leading-snug text-ink">
          {mark(seg.de, open.map((f) => f.triggerDe ?? ''))}
        </p>
        <p lang="en" className="mt-2 text-[14px] leading-relaxed text-muted">
          {mark(seg.en, open.map((f) => f.trigger ?? ''))}
        </p>
      </div>

      {justFixed && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-2xl bg-ok-soft p-4" role="status">
          <CircleCheck size={20} className="mt-0.5 shrink-0 text-ok" aria-hidden />
          <div className="text-[14px]">
            <p className="font-semibold text-ink">Fixed and checked again.</p>
            <p className="mt-0.5 text-ink-2">{st === 'supported' ? 'This sentence is now backed by your evidence.' : 'The original problem is gone. See what’s left below.'}</p>
          </div>
        </div>
      )}

      <div className="space-y-6 px-6 py-6">
        {/* What's wrong / why it's OK */}
        <section>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{st === 'supported' ? 'Why it’s OK' : st === 'none' ? 'Nothing to check' : 'What’s wrong'}</h3>
          {seg.top ? (
            <>
              <p className="mt-2 text-[16px] font-semibold text-ink">{seg.top.title}</p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{seg.top.explanation}</p>
              {open.length > 1 && <p className="mt-2 text-[13px] text-muted">+ {open.length - 1} more problem{open.length > 2 ? 's' : ''} in this sentence</p>}
            </>
          ) : (
            <p className="mt-2 text-[14.5px] text-ink-2">This sentence makes no product claim.</p>
          )}
        </section>

        {missing.length > 0 && (
          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">What’s missing</h3>
            <ul className="mt-2 space-y-2">
              {missing.map((x) => (
                <li key={x} className="flex gap-3 text-[14.5px] text-ink">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#d08a14]" aria-hidden /> {x}
                </li>
              ))}
            </ul>
            {gap && <p className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn">We can’t verify this topic yet, so a specialist needs to check it.</p>}
          </section>
        )}

        {st === 'supported' && evidence.length > 0 && (
          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Your evidence</h3>
            <ul className="mt-2 space-y-2">
              {evidence.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5 text-[14.5px] text-ink">
                  <CircleCheck size={16} className="shrink-0 text-ok" aria-hidden /> {e.title}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-muted">Backed by evidence isn’t legal approval of the wording.</p>
          </section>
        )}

        {/* Fix */}
        {open.length > 0 && !editing && fix && (
          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Suggested fix</h3>
            <div className="mt-2 rounded-2xl border-2 border-teal/25 p-4">
              <p lang="de" className="text-[16px] font-semibold leading-snug text-ink">{fix.de}</p>
              <p lang="en" className="mt-1.5 text-[13.5px] text-muted">{fix.en}</p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{fix.rationale}</p>
              <p className="mt-2 text-[12px] text-muted">{aiFix ? `Suggested by ${server?.model ?? 'AI'}` : 'Prewritten example fix'} · checked automatically when you use it</p>
              {linked.length > 0 && (
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-line pt-3 text-[13.5px] text-ink-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal" checked={applyLinked} onChange={(e) => setApplyLinked(e.target.checked)} />
                  <span>Also fix the same claim in {linked.map((l) => `${DOC_NAME[l.docType]} (${l.field})`).join(', ')}</span>
                </label>
              )}
            </div>
          </section>
        )}

        {editing && (
          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Your wording</h3>
            <label className="block text-[13px] font-medium text-muted" htmlFor="edit-de">German</label>
            <textarea id="edit-de" lang="de" rows={3} className={inputCls} value={draft.de} onChange={(e) => setDraft({ ...draft, de: e.target.value })} />
            <label className="block text-[13px] font-medium text-muted" htmlFor="edit-en">English</label>
            <textarea id="edit-en" rows={2} className={inputCls} value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
          </section>
        )}

        {/* Disclosures */}
        {(refs.length > 0 || findings.length > 0) && !editing && (
          <div className="overflow-hidden rounded-2xl border border-line">
            {refs.length > 0 && (
              <Disclosure title="What the law says" count={refs.length}>
                <ul className="space-y-3">
                  {refs.map((r) => {
                    const p = getProvision(r.sourceId, r.provisionId);
                    return p ? (
                      <li key={r.sourceId + r.provisionId}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-semibold">
                            {p.source.shortName}, {p.provision.label}
                          </span>
                          <a href={p.source.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-teal hover:underline">
                            EUR-Lex <ExternalLink size={11} aria-hidden />
                            <span className="sr-only">(opens in new tab)</span>
                          </a>
                        </div>
                        <blockquote className="mt-1 border-l-2 border-line-2 pl-3 text-[13px] leading-relaxed text-ink-2">{p.provision.excerpt}</blockquote>
                      </li>
                    ) : null;
                  })}
                </ul>
                <p className="mt-3 text-[11.5px] text-muted">Exact quotes from the Official Journal, checked on EUR-Lex.</p>
              </Disclosure>
            )}
            <Disclosure title="All checks on this sentence" count={findings.length} border={refs.length > 0}>
              <ul className="space-y-3">
                {findings.map((f) => (
                  <li key={f.id} className="flex gap-3 text-[13.5px]">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_META[f.status].dot)} aria-hidden />
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{f.title}</div>
                      <div className="text-[12.5px] text-muted">
                        {f.category} · rule {f.ruleId}
                        {f.evidenceUsed.length > 0 &&
                          ` · uses ${state.product.evidence
                            .filter((e) => f.evidenceUsed.includes(e.id))
                            .map((e) => `${e.title} (${kindLabel(e.kind)})`)
                            .join(', ')}`}
                      </div>
                      <div className="mt-0.5 text-ink-2">→ {f.suggestedAction}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        )}
        {aiError && (
          <p role="alert" className="text-[13.5px] text-bad">
            {aiError}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 border-t border-line bg-surface/95 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {editing ? (
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={!draft.en.trim() || !draft.de.trim()}
              onClick={() => {
                dispatch({ type: 'reviseSegments', edits: [{ segmentId: seg.id, ...draft }], decision: 'edited-manually', findingIds: open.map((f) => f.id) });
                setEditing(false);
              }}
            >
              Save and check
            </Button>
            <Button size="lg" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : open.length > 0 ? (
          <>
            {fix ? (
              <Button variant="primary" size="lg" className="w-full" onClick={apply}>
                <Check size={18} aria-hidden /> Use this fix
              </Button>
            ) : st === 'review' && !escalated ? (
              <Button variant="primary" size="lg" className="w-full" onClick={() => dispatch({ type: 'decide', segmentId: seg.id, findingIds: open.map((f) => f.id), decision: 'escalated' })}>
                <Send size={17} aria-hidden /> Send to an expert
              </Button>
            ) : escalated ? (
              <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-soft text-[15px] font-semibold text-teal-ink">
                <Check size={17} aria-hidden /> Sent to an expert
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {state.content!.mode === 'ai' && server?.configured && (
                <Button variant="ghost" size="sm" onClick={askAI} disabled={aiBusy}>
                  {aiBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Cpu size={14} aria-hidden />}
                  {aiBusy ? 'Thinking…' : aiFix ? 'Another AI fix' : 'Fix with AI'}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={14} aria-hidden /> Edit myself
              </Button>
              {fix && st === 'review' && !escalated && (
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'decide', segmentId: seg.id, findingIds: open.map((f) => f.id), decision: 'escalated' })}>
                  <Send size={14} aria-hidden /> Send to an expert
                </Button>
              )}
              {!seg.factKey && (
                <Button variant="ghost" size="sm" className="text-bad hover:bg-bad-soft" onClick={() => dispatch({ type: 'removeSegment', segmentId: seg.id, findingIds: open.map((f) => f.id) })}>
                  <Trash2 size={14} aria-hidden /> Remove
                </Button>
              )}
            </div>
            {seg.factKey && <p className="mt-2 text-center text-[12.5px] text-muted">Comes from your product facts. Add the missing evidence in Launch Studio.</p>}
          </>
        ) : next ? (
          <Button variant="primary" size="lg" className="w-full" onClick={() => onSelect(next.id)}>
            Next item <ArrowRight size={17} aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => onSelect(undefined)}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

function Disclosure({ title, count, border, children }: { title: string; count: number; border?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx(border && 'border-t border-line')}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[14.5px] font-semibold text-ink hover:bg-canvas">
        <span>
          {title} <span className="font-normal text-muted">({count})</span>
        </span>
        <ChevronDown size={17} className={cx('text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="px-4 pb-4 fade-in">{children}</div>}
    </div>
  );
}
