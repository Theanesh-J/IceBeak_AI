import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Columns2,
  Cpu,
  ExternalLink,
  Eye,
  ListChecks,
  Loader2,
  Pencil,
  RefreshCw,
  ScanSearch,
  Send,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { navigate, useServer } from '../App';
import type { DocType, EvidenceStatus, Finding, Segment } from '../../../data/types';
import { STATUS_RANK, isLaunchFinding, launchSteps, splitCounts, wordingStatus, type LaunchStep } from '../../../trust/rules';
import { getProvision } from '../../../regulatory/sources';
import { sampleRevisionFor } from '../../../localise/compose';
import { reviseWithAI } from '../lib/api';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, STATUS_META, cx, formatTime, inputCls } from '../components/ui';
import { CompareRow, DocTabs, ShopPreview } from './LocalisedContent';

const DOC_NAME: Record<DocType, string> = { listing: 'Listing', marketing: 'Marketing', info: 'Product info' };
const GROUP_HINT: Record<EvidenceStatus, string> = {
  blocked: 'These can’t be published as they are.',
  review: 'Your evidence doesn’t settle these. Change the wording, or ask an expert.',
  supported: 'Your evidence covers these sentences.',
};

type View = 'list' | 'doc' | 'shop';
type Seg = Segment & { status: EvidenceStatus | 'none'; top?: Finding };

/** Wording view of every sentence: launch prerequisites are left out here. */
function useSegments(): Seg[] {
  const { state } = useStore();
  return useMemo(() => {
    if (!state.content || !state.validation) return [];
    const f = state.validation.findings.filter((x) => !isLaunchFinding(x));
    return state.content.segments.map((s) => {
      const mine = f.filter((x) => x.segmentId === s.id).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
      return { ...s, status: wordingStatus(state.validation!.findings, s.id), top: mine[0] };
    });
  }, [state.content, state.validation]);
}

export function TrustMapView({ initialView = 'list' }: { initialView?: View }) {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<View>(initialView);
  const [launchKey, setLaunchKey] = useState<string | null>(null);
  const segs = useSegments();

  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      dispatch({ type: 'select', segmentId: undefined });
      setLaunchKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  if (!state.content || !state.validation) {
    return (
      <EmptyState
        icon={<ScanSearch size={18} />}
        title="Nothing to review yet"
        body="Create the German version of your product first. Every sentence is checked as soon as it’s written."
        action={
          <Button variant="primary" onClick={() => navigate('studio')}>
            Go to your product
          </Button>
        }
      />
    );
  }

  const steps = launchSteps(state.validation.findings, state.content.segments);
  const step = steps.find((s) => s.key === launchKey);
  const selected = !step ? segs.find((s) => s.id === state.selectedSegmentId) : undefined;
  const openSentence = (id?: string) => {
    setLaunchKey(null);
    dispatch({ type: 'select', segmentId: id });
  };
  const openStep = (key: string) => {
    dispatch({ type: 'select', segmentId: undefined });
    setLaunchKey(key);
  };
  const close = () => openSentence(undefined);
  const queue = [...segs.filter((s) => s.status === 'blocked'), ...segs.filter((s) => s.status === 'review')];
  const nextStep = steps.find((s) => !s.done && !s.findings.every((f) => state.decisions[f.id]));
  const next = queue[0] ? () => openSentence(queue[0].id) : nextStep ? () => openStep(nextStep.key) : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
      <div className="min-w-0 space-y-6">
        <Summary segs={segs} steps={steps} onNext={next} nextIsFix={queue.some((s) => s.status === 'blocked')} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-fill p-1 [scrollbar-width:none]" role="tablist" aria-label="View">
            {(
              [
                ['list', 'To-do', ListChecks],
                ['doc', 'Side by side', Columns2],
                ['shop', 'Shop preview', Eye],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cx(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors',
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

        {view === 'list' && (
          <>
            <TodoList segs={segs} selectedId={selected?.id} onSelect={openSentence} />
            <LaunchChecklist steps={steps} selectedKey={step?.key} onSelect={openStep} />
          </>
        )}
        {view === 'doc' && <SideBySide segs={segs} onSelect={openSentence} />}
        {view === 'shop' && (
          <ShopPreview
            segments={state.content.segments.filter((s) => s.docType === 'listing')}
            status={(id) => segs.find((s) => s.id === id)?.status ?? 'none'}
            onInspect={(id) => openSentence(id)}
            inci={state.content.segments.find((s) => s.id === 'pi-inci')?.de}
          />
        )}
      </div>

      {selected || step ? (
        <>
          <div className="fixed inset-0 z-30 bg-navy/40 fade-in lg:hidden" onClick={close} aria-hidden />
          <aside
            aria-label="Details"
            className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl sheet-in lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:max-h-[calc(100vh-3rem)] lg:self-start lg:rounded-2xl lg:border lg:border-line lg:shadow-none"
          >
            {selected ? (
              <SentenceDetail key={selected.id + state.contentVersion} seg={selected} queue={queue} onSelect={openSentence} onClose={close} />
            ) : (
              <StepDetail key={step!.key + state.contentVersion} step={step!} steps={steps} onSelect={openStep} onClose={close} />
            )}
          </aside>
        </>
      ) : (
        <div className="hidden lg:block">
          <Card className="sticky top-6 p-6">
            <h2 className="text-[17px] font-semibold">Pick an item to see the details</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">You’ll see what’s wrong, what’s missing, and a fix you can apply in one tap.</p>
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
              Labels show how far your evidence covers each sentence. They aren’t legal approval.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- Summary ---------- */

function Summary({ segs, steps, onNext, nextIsFix }: { segs: Seg[]; steps: LaunchStep[]; onNext?: () => void; nextIsFix: boolean }) {
  const { state } = useStore();
  const c = splitCounts(state.validation!.findings, state.content!.segments);
  const shown = segs.filter((s) => s.status !== 'none');
  const d = state.lastDiff;
  // A step that's already with an expert no longer needs sorting by the user.
  const launchLeft = steps.filter((s) => !s.done && !s.findings.every((f) => state.decisions[f.id]?.decision === 'escalated')).length;

  return (
    <Card className="p-6 sm:p-7">
      <p className="text-[14px] font-medium text-muted">Before you launch in Germany</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          {c.blocked > 0 ? (
            <h2 className="flex items-baseline gap-3 text-ink">
              <span className="text-[52px] font-semibold leading-none tracking-tight tabular-nums">{c.blocked}</span>
              <span className="text-[22px] font-semibold tracking-tight">{c.blocked === 1 ? 'sentence to fix' : 'sentences to fix'}</span>
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
            {c.review} {c.review === 1 ? 'needs' : 'need'} an expert · {launchLeft} launch step{launchLeft === 1 ? '' : 's'} to sort · {c.supported} backed by evidence
          </p>
        </div>
        {onNext && (
          <Button variant="primary" size="lg" onClick={onNext}>
            {nextIsFix ? 'Fix next' : 'Next item'} <ArrowRight size={17} aria-hidden />
          </Button>
        )}
      </div>

      <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-fill" role="img" aria-label={`${c.supported} of ${shown.length} claims backed by evidence, ${c.review} need an expert, ${c.blocked} to fix`}>
        {(['supported', 'review', 'blocked'] as const).map((s) =>
          c[s] ? <span key={s} className={cx('h-full transition-all duration-500', STATUS_META[s].dot)} style={{ width: `${(c[s] / shown.length) * 100}%` }} /> : null,
        )}
      </div>
      <div className="mt-2 flex justify-between text-[12.5px] text-muted">
        <span>{shown.length} claims checked</span>
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

/* ---------- To-do: wording ---------- */

function TodoList({ segs, selectedId, onSelect }: { segs: Seg[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [showOk, setShowOk] = useState(false);
  const groups = (['blocked', 'review', 'supported'] as const).map((s) => [s, segs.filter((x) => x.status === s)] as const);

  return (
    <div className="space-y-8">
      <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Fix your wording</h2>
      {groups.map(([status, items]) => {
        if (!items.length) return null;
        const m = STATUS_META[status];
        const collapsed = status === 'supported' && !showOk;
        return (
          <section key={status} aria-labelledby={`grp-${status}`} className="-mt-4">
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
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {items.map((s, i) => (
                  <li key={s.id} className={cx(i > 0 && 'border-t border-line')}>
                    <button
                      onClick={() => onSelect(s.id)}
                      aria-current={selectedId === s.id ? 'true' : undefined}
                      className={cx('flex w-full items-center gap-4 px-4 py-4 text-left transition-colors sm:px-5', selectedId === s.id ? 'bg-teal-soft/70' : 'hover:bg-canvas')}
                    >
                      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', m.soft)}>
                        <m.Icon size={19} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span lang="de" className="line-clamp-2 block text-[15px] font-medium leading-snug text-ink">
                          {s.de}
                        </span>
                        <span className="mt-1 block truncate text-[13px] text-muted">
                          {status === 'supported' ? `${DOC_NAME[s.docType]} · ${s.field}` : `${s.top?.title} · ${DOC_NAME[s.docType]}`}
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
    </div>
  );
}

/* ---------- To-do: launch prerequisites ---------- */

function LaunchChecklist({ steps, selectedKey, onSelect }: { steps: LaunchStep[]; selectedKey?: string; onSelect: (key: string) => void }) {
  const { state } = useStore();
  if (!steps.length) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="launch-title">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 id="launch-title" className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <Store size={17} className="text-ink-2" aria-hidden /> Before you can sell in Germany
          </h2>
          <p className="mt-0.5 text-[13.5px] text-muted">Not about your wording. Business steps a specialist helps with.</p>
        </div>
        <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-ink-2">
          {done} of {steps.length} done
        </span>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {steps.map((s, i) => {
          const sent = !s.done && s.findings.every((f) => state.decisions[f.id]?.decision === 'escalated');
          return (
            <li key={s.key} className={cx(i > 0 && 'border-t border-line')}>
              <button
                onClick={() => onSelect(s.key)}
                aria-current={selectedKey === s.key ? 'true' : undefined}
                className={cx('flex w-full items-center gap-4 px-4 py-4 text-left transition-colors sm:px-5', selectedKey === s.key ? 'bg-teal-soft/70' : 'hover:bg-canvas')}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                    s.done ? 'border-ok-dot bg-ok-dot text-white' : sent ? 'border-warn-dot text-warn' : 'border-line-2',
                  )}
                  aria-hidden
                >
                  {s.done ? <Check size={15} strokeWidth={3} /> : sent ? <Send size={12} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-[15px] font-medium', s.done ? 'text-muted line-through' : 'text-ink')}>{s.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">{s.done ? 'Done' : sent ? 'Sent to an expert' : s.findings[0].missing[0] ?? s.findings[0].title}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Side by side ---------- */

function SideBySide({ segs, onSelect }: { segs: Seg[]; onSelect: (id: string) => void }) {
  const [tab, setTab] = useState<DocType>('listing');
  const blockedIn = (d: DocType) => segs.filter((s) => s.docType === d && s.status === 'blocked').length;
  const rows = segs.filter((s) => s.docType === tab);
  return (
    <div className="space-y-4">
      <DocTabs value={tab} onChange={setTab} counts={{ listing: blockedIn('listing'), marketing: blockedIn('marketing'), info: blockedIn('info') }} />
      <Card className="overflow-hidden">
        <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] gap-6 border-b border-line px-6 py-3 text-[12.5px] font-medium text-muted md:grid">
            <span>English · what you wrote</span>
            <span>German · what customers read</span>
            <span />
          </div>
          <ul>
            {rows.map((s, i) => (
              <CompareRow key={s.id} seg={s} status={s.status} first={i === 0} onOpen={() => onSelect(s.id)} />
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Shared detail pieces ---------- */

function mark(text: string, triggers: string[]): ReactNode {
  const t = triggers.filter((x) => x && text.toLowerCase().includes(x.toLowerCase()));
  if (!t.length) return text;
  const re = new RegExp(`(${t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((p, i) =>
    i % 2 ? (
      <mark key={i} className="rounded bg-mark px-0.5 text-ink">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

function DetailHeader({ icon, title, sub, onClose }: { icon: ReactNode; title: string; sub: string; onClose: () => void }) {
  return (
    <>
      <div className="flex justify-center pt-3 lg:hidden" aria-hidden>
        <span className="h-1.5 w-10 rounded-full bg-line-2" />
      </div>
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="text-[17px] font-semibold text-ink">{title}</div>
            <div className="text-[13px] text-muted">{sub}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-fill hover:text-ink" aria-label="Close">
          <X size={18} aria-hidden />
        </button>
      </div>
    </>
  );
}

function LawQuotes({ findings }: { findings: Finding[] }) {
  const refs = [...new Map(findings.flatMap((f) => f.sourceRefs).map((r) => [r.sourceId + r.provisionId, r])).values()];
  if (!refs.length) return null;
  return (
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
  );
}

function Disclosure({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line first:border-t-0">
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

const Label = ({ children }: { children: ReactNode }) => <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h3>;

/* ---------- Sentence detail ---------- */

function SentenceDetail({ seg, queue, onSelect, onClose }: { seg: Seg; queue: Seg[]; onSelect: (id?: string) => void; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { status: server } = useServer();
  const all = state.validation!.findings;
  const findings = all.filter((f) => f.segmentId === seg.id && !isLaunchFinding(f)).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const open = findings.filter((f) => f.status !== 'supported');
  const st = seg.status;
  const m = STATUS_META[st];
  const missing = [...new Set(open.flatMap((f) => f.missing))];
  const evidence = state.product.evidence.filter((e) => findings.some((f) => f.evidenceUsed.includes(e.id)));
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
        ? state.content!.segments.filter((s) => s.id !== seg.id && s.claimRef === seg.claimRef && wordingStatus(all, s.id) === 'blocked' && sampleRevisionFor(s))
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
        ids.push(...all.filter((f) => f.segmentId === s.id && f.status !== 'supported' && !isLaunchFinding(f)).map((f) => f.id));
      }
    dispatch({ type: 'reviseSegments', edits, decision: 'revision-applied', findingIds: ids, note: fix.rationale });
  };
  const sendToExpert = () => dispatch({ type: 'decide', segmentId: seg.id, findingIds: open.map((f) => f.id), decision: 'escalated' });
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
      <DetailHeader
        icon={
          <span className={cx('flex h-11 w-11 items-center justify-center rounded-full', m.soft)}>
            <m.Icon size={22} aria-hidden />
          </span>
        }
        title={justFixed ? 'Fixed' : m.short}
        sub={`${DOC_NAME[seg.docType]} · ${seg.field}`}
        onClose={onClose}
      />

      <div className="mx-6 mt-5 rounded-2xl bg-fill p-4">
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
        <section>
          <Label>{st === 'supported' ? 'Why it’s OK' : st === 'none' ? 'Nothing to check' : 'What’s wrong'}</Label>
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
            <Label>What’s missing</Label>
            <ul className="mt-2 space-y-2">
              {missing.map((x) => (
                <li key={x} className="flex gap-3 text-[14.5px] text-ink">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-warn-dot" aria-hidden /> {x}
                </li>
              ))}
            </ul>
            {gap && <p className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn">We can’t verify this topic yet, so an expert needs to check it.</p>}
          </section>
        )}

        {st === 'supported' && evidence.length > 0 && (
          <section>
            <Label>Your evidence</Label>
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

        {open.length > 0 && !editing && fix && (
          <section>
            <Label>Suggested fix</Label>
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
            <Label>Your wording</Label>
            <label className="block text-[13px] font-medium text-muted" htmlFor="edit-de">German</label>
            <textarea id="edit-de" lang="de" rows={3} className={inputCls} value={draft.de} onChange={(e) => setDraft({ ...draft, de: e.target.value })} />
            <label className="block text-[13px] font-medium text-muted" htmlFor="edit-en">English</label>
            <textarea id="edit-en" rows={2} className={inputCls} value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
          </section>
        )}

        {findings.length > 0 && !editing && (
          <div className="overflow-hidden rounded-2xl border border-line">
            <LawQuotes findings={findings} />
            <Disclosure title="All checks on this sentence" count={findings.length}>
              <ul className="space-y-3">
                {findings.map((f) => (
                  <li key={f.id} className="flex gap-3 text-[13.5px]">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_META[f.status].dot)} aria-hidden />
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{f.title}</div>
                      <div className="text-[12.5px] text-muted">
                        {f.category} · rule {f.ruleId}
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
              <Button variant="primary" size="lg" className="w-full" onClick={sendToExpert}>
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
                <Button variant="ghost" size="sm" onClick={sendToExpert}>
                  <Send size={14} aria-hidden /> Send to an expert
                </Button>
              )}
              {!seg.factKey && (
                <Button variant="ghost" size="sm" className="text-bad hover:bg-bad-soft" onClick={() => dispatch({ type: 'removeSegment', segmentId: seg.id, findingIds: open.map((f) => f.id) })}>
                  <Trash2 size={14} aria-hidden /> Remove
                </Button>
              )}
            </div>
          </>
        ) : next ? (
          <Button variant="primary" size="lg" className="w-full" onClick={() => onSelect(next.id)}>
            Next item <ArrowRight size={17} aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Launch step detail ---------- */

function StepDetail({ step, steps, onSelect, onClose }: { step: LaunchStep; steps: LaunchStep[]; onSelect: (key: string) => void; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const f = step.findings[0];
  const open = step.findings.filter((x) => x.status !== 'supported');
  const sent = open.length > 0 && open.every((x) => state.decisions[x.id]?.decision === 'escalated');
  const evidence = state.product.evidence.filter((e) => step.findings.some((x) => x.evidenceUsed.includes(e.id)));
  const next = steps.find((s) => s.key !== step.key && !s.done && !s.findings.every((x) => state.decisions[x.id]));
  const needsEvidence = f.ruleId === 'R18';

  return (
    <div className="fade-in">
      <DetailHeader
        icon={
          <span className={cx('flex h-11 w-11 items-center justify-center rounded-full', step.done ? 'bg-ok-soft text-ok' : 'bg-fill text-ink')}>
            {step.done ? <Check size={22} aria-hidden /> : <Store size={20} aria-hidden />}
          </span>
        }
        title={step.title}
        sub={step.done ? 'Done' : sent ? 'Sent to an expert' : 'Before you can sell in Germany'}
        onClose={onClose}
      />

      <div className="space-y-6 px-6 py-6">
        <section>
          <Label>{step.done ? 'Why it’s done' : 'Why it matters'}</Label>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{f.explanation}</p>
        </section>

        {open.length > 0 && f.missing.length > 0 && (
          <section>
            <Label>What’s missing</Label>
            <ul className="mt-2 space-y-2">
              {[...new Set(open.flatMap((x) => x.missing))].map((x) => (
                <li key={x} className="flex gap-3 text-[14.5px] text-ink">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-warn-dot" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </section>
        )}

        {evidence.length > 0 && (
          <section>
            <Label>On file</Label>
            <ul className="mt-2 space-y-2">
              {evidence.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5 text-[14.5px] text-ink">
                  <CircleCheck size={16} className={cx('shrink-0', step.done ? 'text-ok' : 'text-muted')} aria-hidden /> {e.title}
                  {e.jurisdiction !== 'n/a' && <span className="text-[12.5px] text-muted">({e.jurisdiction})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {f.sourceGap && <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn">{f.sourceGap}</p>}

        <div className="overflow-hidden rounded-2xl border border-line">
          <LawQuotes findings={step.findings} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface/95 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {step.done ? (
          next ? (
            <Button variant="primary" size="lg" className="w-full" onClick={() => onSelect(next.key)}>
              Next step <ArrowRight size={17} aria-hidden />
            </Button>
          ) : (
            <Button size="lg" className="w-full" onClick={onClose}>
              Done
            </Button>
          )
        ) : sent ? (
          <>
            <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-soft text-[15px] font-semibold text-teal-ink">
              <Check size={17} aria-hidden /> Sent to an expert
            </div>
            {next && (
              <Button variant="ghost" size="sm" className="mx-auto mt-2 flex" onClick={() => onSelect(next.key)}>
                Next step <ArrowRight size={14} aria-hidden />
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => dispatch({ type: 'decide', segmentId: step.segmentId, findingIds: open.map((x) => x.id), decision: 'escalated' })}
            >
              <Send size={17} aria-hidden /> Send to an expert
            </Button>
            {needsEvidence && (
              <Button variant="ghost" size="sm" className="mx-auto mt-2 flex" onClick={() => navigate('studio')}>
                Already have it? Add it to your evidence
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
