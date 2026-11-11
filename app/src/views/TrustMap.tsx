import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  FileWarning,
  Loader2,
  Pencil,
  RefreshCw,
  ScanSearch,
  Send,
  Trash2,
  TriangleAlert,
  Cpu,
  X,
} from 'lucide-react';
import { navigate, useServer } from '../App';
import type { DocType, EvidenceStatus, Finding, Segment } from '../domain/types';
import { STATUS_RANK, segmentStatus, summarise } from '../domain/rules';
import { getProvision } from '../domain/sources';
import { sampleRevisionFor } from '../domain/compose';
import { reviseWithAI } from '../lib/api';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, STATUS_META, StatusBadge, cx, formatTime, inputCls } from '../components/ui';
import { DocTabs } from './LocalisedContent';
import { kindLabel } from './LaunchStudio';

type Filter = EvidenceStatus | 'none';

export function TrustMapView() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<DocType>(() => {
    const sel = state.content?.segments.find((s) => s.id === state.selectedSegmentId);
    return sel?.docType ?? 'listing';
  });
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [filters, setFilters] = useState<Set<Filter>>(new Set(['blocked', 'review', 'supported', 'none']));

  if (!state.content || !state.validation) {
    return (
      <EmptyState
        icon={<ScanSearch size={18} />}
        title="Nothing to inspect yet"
        body="Generate German content in Launch Studio. TrustMap checks every statement as soon as it is generated."
        action={<Button variant="primary" onClick={() => navigate('studio')}>Go to Launch Studio</Button>}
      />
    );
  }

  const { content, validation } = state;
  const findings = validation.findings;
  const stale = isStale(state);
  const counts = summarise(findings, content.segments);
  const statusOf = (id: string) => segmentStatus(findings, id);
  const selected = content.segments.find((s) => s.id === state.selectedSegmentId);
  const select = (s: Segment) => {
    dispatch({ type: 'select', segmentId: s.id });
    setTab(s.docType);
  };
  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n.size ? n : prev;
    });
  const blockedIn = (d: DocType) => content.segments.filter((s) => s.docType === d && statusOf(s.id) === 'blocked').length;

  return (
    <div className="space-y-4">
      {/* Summary + recheck */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter statements by status">
            {(['blocked', 'review', 'supported', 'none'] as const).map((s) => {
              const m = STATUS_META[s];
              const on = filters.has(s);
              return (
                <button
                  key={s}
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={cx(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                    on ? 'border-line-2 bg-surface' : 'border-dashed border-line bg-canvas opacity-60',
                  )}
                >
                  <span className={cx('h-2.5 w-2.5 rounded-full', m.dot)} aria-hidden />
                  <span className="text-lg font-semibold tabular-nums leading-none">{counts[s]}</span>
                  <span className="text-[12.5px] leading-tight text-muted">{m.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-muted">
              Last check {formatTime(validation.ranAt)} · {validation.rulesRun.length} rules
            </span>
            <Button variant={stale ? 'primary' : 'secondary'} onClick={() => dispatch({ type: 'runValidation' })}>
              <RefreshCw size={14} aria-hidden /> {stale ? 'Re-run checks' : 'Run checks again'}
            </Button>
          </div>
        </div>

        {stale && (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[13px] text-warn" role="status">
            <TriangleAlert size={14} aria-hidden /> Content changed since the last check. Statuses shown are out of date until you re-run the checks.
          </p>
        )}
        {!stale && state.lastDiff && <RecheckResult />}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        {/* Document with highlights */}
        <Card className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-2 sm:px-5">
            <DocTabs value={tab} onChange={setTab} counts={{ listing: blockedIn('listing'), marketing: blockedIn('marketing'), info: blockedIn('info') }} />
            <div className="mb-2 flex rounded-md bg-canvas p-0.5 text-[12.5px]" role="group" aria-label="Document language">
              {(['de', 'en'] as const).map((l) => (
                <button
                  key={l}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={cx('rounded px-2.5 py-1 font-medium', lang === l ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink')}
                >
                  {l === 'de' ? 'German output' : 'English source'}
                </button>
              ))}
            </div>
          </div>
          <div role="tabpanel" aria-labelledby={`tab-${tab}`} lang={lang} className="space-y-1 p-4 sm:p-6">
            {content.segments
              .filter((s) => s.docType === tab)
              .map((s) => {
                const st = statusOf(s.id);
                const visible = filters.has(st);
                return (
                  <div key={s.id} className={cx('grid gap-1 py-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4', !visible && 'opacity-35')}>
                    <span className="pt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-muted">{s.field}</span>
                    <p className={cx('text-[15.5px] leading-[1.75]', s.untranslated && lang === 'de' ? 'italic text-muted' : 'text-ink')}>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected?.id === s.id}
                        aria-label={`${s.field}: ${STATUS_META[st].label}. ${lang === 'de' ? s.de : s.en}`}
                        onClick={() => select(s)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            select(s);
                          }
                        }}
                        className={cx(st === 'none' ? 'hl hl-none' : `hl hl-${st}`, selected?.id === s.id && 'hl-selected')}
                      >
                        {lang === 'de' ? s.de : s.en}
                      </span>
                    </p>
                  </div>
                );
              })}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-[12px] text-muted">
            {(['supported', 'review', 'blocked'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cx('hl inline-block h-3 w-5', `hl-${s}`)} aria-hidden /> {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </Card>

        {/* Inspector */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {selected ? (
            <Inspector key={selected.id + state.contentVersion} segment={selected} onSelect={select} />
          ) : (
            <OpenIssues onSelect={select} />
          )}
        </div>
      </div>

      <p className="text-center text-[12px] text-muted">
        Statuses describe how far the evidence provided covers each statement. A supported statement is not legally approved, and fluent German is not proof of accuracy.
      </p>
    </div>
  );
}

function RecheckResult() {
  const { state } = useStore();
  const d = state.lastDiff!;
  const segName = (f: Finding) => state.content?.segments.find((s) => s.id === f.segmentId)?.field ?? 'Removed statement';
  return (
    <div className="mt-4 rounded-lg border border-line bg-canvas/70 p-3.5 text-[13px] fade-in" role="status">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
        <span className="flex items-center gap-1.5 text-ok">
          <CircleCheck size={15} aria-hidden /> Recheck: {d.resolved.length} issue{d.resolved.length === 1 ? '' : 's'} resolved
        </span>
        {d.added.length > 0 && (
          <span className="flex items-center gap-1.5 text-bad">
            <TriangleAlert size={15} aria-hidden /> {d.added.length} new
          </span>
        )}
        <span className="text-warn">{d.stillOpen} item{d.stillOpen === 1 ? '' : 's'} still need review or expert input</span>
      </div>
      {d.resolved.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-muted">
          {d.resolved.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5">
              <Check size={13} className="text-ok" aria-hidden /> <span className="line-through decoration-muted/50">{f.title}</span>
              <span className="text-[12px]">· {segName(f)}</span>
            </li>
          ))}
        </ul>
      )}
      {d.added.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-bad">
          {d.added.map((f) => (
            <li key={f.id}>
              New: {f.title} · {segName(f)}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-muted">Resolved means the evidence check no longer finds this problem. It is not a legal approval of the revised wording.</p>
    </div>
  );
}

function OpenIssues({ onSelect }: { onSelect: (s: Segment) => void }) {
  const { state } = useStore();
  const segs = state.content!.segments;
  const findings = state.validation!.findings;
  const open = segs
    .map((s) => ({ s, st: segmentStatus(findings, s.id) }))
    .filter((x) => x.st === 'blocked' || x.st === 'review')
    .sort((a, b) => STATUS_RANK[b.st as EvidenceStatus] - STATUS_RANK[a.st as EvidenceStatus]);
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Evidence inspector</h2>
      <p className="mt-1 text-[13px] text-muted">Select a highlighted statement to see why it has its status, which evidence or source applies, and what to do next.</p>
      <h3 className="mt-5 text-[12px] font-medium uppercase tracking-wide text-muted">Open items ({open.length})</h3>
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
        {open.map(({ s, st }) => {
          const top = findings.filter((f) => f.segmentId === s.id).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0];
          return (
            <li key={s.id}>
              <button onClick={() => onSelect(s)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-canvas">
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_META[st].dot)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{top?.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {s.field} · {s.de}
                  </span>
                </span>
                <ChevronRight size={15} className="mt-1 text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
        {open.length === 0 && <li className="px-3 py-4 text-[13px] text-muted">No open items. All statements with claims are covered by the evidence provided.</li>}
      </ul>
    </Card>
  );
}

function highlight(text: string, triggers: string[]): ReactNode {
  const t = triggers.filter((x) => x && text.toLowerCase().includes(x.toLowerCase()));
  if (!t.length) return text;
  const re = new RegExp(`(${t.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-[#ffe08a] px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function Inspector({ segment, onSelect }: { segment: Segment; onSelect: (s: Segment) => void }) {
  const { state, dispatch } = useStore();
  const { status: server } = useServer();
  const findings = state.validation!.findings.filter((f) => f.segmentId === segment.id).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const st = segmentStatus(state.validation!.findings, segment.id);
  const stale = isStale(state);
  const openFindings = findings.filter((f) => f.status !== 'supported');
  const triggers = findings.map((f) => f.trigger ?? '');
  const triggersDe = findings.map((f) => f.triggerDe ?? '');
  const decision = openFindings.map((f) => state.decisions[f.id]).find(Boolean);
  const changedSinceCheck = stale && state.validation!.snapshot?.[segment.id] !== `${segment.en}\n${segment.de}`;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ en: segment.en, de: segment.de });
  const [aiRevision, setAiRevision] = useState<{ en: string; de: string; rationale: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const sampleRevision = openFindings.length && !changedSinceCheck ? sampleRevisionFor(segment) : undefined;
  const revision = aiRevision ?? sampleRevision;
  const revisionOrigin = aiRevision ? `Drafted by ${server?.model ?? 'the model'}` : 'Curated revision from the sample scenario';

  // Other statements derived from the same source claim that are also flagged.
  const linked = useMemo(() => {
    if (!segment.claimRef || !revision) return [];
    return state.content!.segments.filter(
      (s) =>
        s.id !== segment.id &&
        s.claimRef === segment.claimRef &&
        segmentStatus(state.validation!.findings, s.id) === 'blocked' &&
        sampleRevisionFor(s),
    );
  }, [segment, revision, state.content, state.validation]);
  const [applyLinked, setApplyLinked] = useState(true);

  const approve = () => {
    if (!revision) return;
    const edits = [{ segmentId: segment.id, en: revision.en, de: revision.de }];
    const ids = openFindings.map((f) => f.id);
    if (applyLinked) {
      for (const s of linked) {
        const r = sampleRevisionFor(s)!;
        edits.push({ segmentId: s.id, en: r.en, de: r.de });
        ids.push(...state.validation!.findings.filter((f) => f.segmentId === s.id && f.status !== 'supported').map((f) => f.id));
      }
    }
    dispatch({ type: 'reviseSegments', edits, decision: 'revision-applied', findingIds: ids, note: revision.rationale });
  };

  const draftWithAI = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      setAiRevision(await reviseWithAI(state.product, segment, openFindings));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not draft a revision.');
    } finally {
      setAiBusy(false);
    }
  };

  const nextOpen = () => {
    const segs = state.content!.segments;
    const open = segs.filter((s) => ['blocked', 'review'].includes(segmentStatus(state.validation!.findings, s.id)));
    if (!open.length) return;
    const i = open.findIndex((s) => s.id === segment.id);
    onSelect(open[(i + 1) % open.length]);
  };

  return (
    <Card className="fade-in overflow-hidden">
      {/* Header */}
      <div className="border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted">
              {segment.docType === 'listing' ? 'Product listing' : segment.docType === 'marketing' ? 'Marketing' : 'Product information'} · {segment.field}
            </div>
            <div className="mt-2">
              <StatusBadge status={st} long />
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={nextOpen} title="Next open item">
              Next <ChevronRight size={14} aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'select', segmentId: undefined })} aria-label="Close inspector">
              <X size={15} aria-hidden />
            </Button>
          </div>
        </div>
        {changedSinceCheck && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn" role="status">
            <span>This statement was changed. Its status is from the previous check.</span>
            <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'runValidation' })}>
              <RefreshCw size={13} aria-hidden /> Re-run checks
            </Button>
          </p>
        )}

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-[11.5px] font-medium text-muted">Original English statement</dt>
            <dd lang="en" className="mt-1 text-[14px] leading-relaxed text-ink-2">
              {highlight(segment.en, triggers)}
            </dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-medium text-muted">Generated German statement</dt>
            <dd lang="de" className="mt-1 text-[14.5px] font-medium leading-relaxed text-ink">
              {highlight(segment.de, triggersDe)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Findings */}
      <div className="divide-y divide-line">
        {findings.length === 0 && (
          <p className="p-5 text-[13px] text-muted">No claim detected in this statement, so there is no evidence to check. The engine looks for efficacy, ingredient, free-from, medicinal, suitability and origin claims, plus product facts.</p>
        )}
        {findings.map((f, i) => (
          <FindingBlock key={f.id} finding={f} defaultOpen={i === 0} />
        ))}
      </div>

      {/* Reviewer decision */}
      {openFindings.length > 0 && !changedSinceCheck && (
        <div className="border-t border-line bg-canvas/60 p-5">
          <h3 className="text-[13px] font-semibold">Reviewer decision</h3>
          {decision && (
            <p className="mt-1 text-[12.5px] text-muted">
              Recorded: {decision.decision === 'escalated' ? 'Escalated to expert' : decision.decision === 'acknowledged' ? 'Kept for expert review' : decision.decision} ·{' '}
              {formatTime(decision.at)}
            </p>
          )}

          {revision && !editing && (
            <div className="mt-3 rounded-lg border border-teal/30 bg-surface p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-teal-ink">Proposed revision</span>
                <span className="text-[11.5px] text-muted">{revisionOrigin}</span>
              </div>
              <p lang="en" className="mt-2 text-[13.5px] text-ink-2">{revision.en}</p>
              <p lang="de" className="mt-1 text-[14px] font-medium text-ink">{revision.de}</p>
              <p className="mt-2 text-[12.5px] text-muted">{revision.rationale}</p>
              {linked.length > 0 && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12.5px] text-ink-2">
                  <input type="checkbox" className="mt-0.5 accent-teal" checked={applyLinked} onChange={(e) => setApplyLinked(e.target.checked)} />
                  <span>
                    Also revise {linked.length} linked statement{linked.length > 1 ? 's' : ''} derived from the same claim:{' '}
                    {linked.map((l) => `${l.docType === 'marketing' ? 'Marketing' : 'Listing'} · ${l.field}`).join(', ')}
                  </span>
                </label>
              )}
              <p className="mt-3 text-[11.5px] text-muted">Approving changes the text only. The new wording is checked again when you re-run the checks.</p>
            </div>
          )}

          {editing ? (
            <div className="mt-3 space-y-2">
              <label className="block text-[12px] font-medium text-muted" htmlFor="edit-en">English</label>
              <textarea id="edit-en" rows={2} className={inputCls} value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
              <label className="block text-[12px] font-medium text-muted" htmlFor="edit-de">German</label>
              <textarea id="edit-de" lang="de" rows={2} className={inputCls} value={draft.de} onChange={(e) => setDraft({ ...draft, de: e.target.value })} />
              <div className="flex gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!draft.en.trim() || !draft.de.trim()}
                  onClick={() => {
                    dispatch({
                      type: 'reviseSegments',
                      edits: [{ segmentId: segment.id, ...draft }],
                      decision: 'edited-manually',
                      findingIds: openFindings.map((f) => f.id),
                    });
                    setEditing(false);
                  }}
                >
                  Save edit
                </Button>
                <Button size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {revision && (
                <Button variant="primary" size="sm" onClick={approve}>
                  <Check size={14} aria-hidden /> Approve revision
                </Button>
              )}
              {state.content!.mode === 'ai' && server?.configured && (
                <Button size="sm" onClick={draftWithAI} disabled={aiBusy}>
                  {aiBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Cpu size={14} aria-hidden />}
                  {aiBusy ? 'Drafting…' : aiRevision ? 'Redraft with AI' : 'Draft revision with AI'}
                </Button>
              )}
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil size={14} aria-hidden /> Edit manually
              </Button>
              {st === 'review' && (
                <Button
                  size="sm"
                  onClick={() => dispatch({ type: 'decide', segmentId: segment.id, findingIds: openFindings.map((f) => f.id), decision: 'escalated' })}
                >
                  <Send size={14} aria-hidden /> Escalate to expert
                </Button>
              )}
              {!segment.factKey && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => dispatch({ type: 'removeSegment', segmentId: segment.id, findingIds: openFindings.map((f) => f.id) })}
                >
                  <Trash2 size={14} aria-hidden /> Remove statement
                </Button>
              )}
            </div>
          )}
          {aiError && (
            <p role="alert" className="mt-2 text-[12.5px] text-bad">
              {aiError}
            </p>
          )}
          {st === 'blocked' && !editing && (
            <p className="mt-3 text-[12px] text-muted">Blocked statements cannot be approved as they are. Revise, edit or remove them.</p>
          )}
          {segment.factKey && !editing && (
            <p className="mt-3 text-[12px] text-muted">This line is composed from product facts and evidence. Add the missing evidence in Launch Studio and regenerate to update it.</p>
          )}
        </div>
      )}

      {st === 'supported' && (
        <div className="border-t border-line bg-ok-soft/50 px-5 py-3 text-[12.5px] text-ok">
          Covered by the evidence provided. This is not a legal approval of the wording.
        </div>
      )}
    </Card>
  );
}

function FindingBlock({ finding: f, defaultOpen }: { finding: Finding; defaultOpen: boolean }) {
  const { state } = useStore();
  const [open, setOpen] = useState(defaultOpen);
  const evidence = state.product.evidence.filter((e) => f.evidenceUsed.includes(e.id));
  return (
    <section className="p-5">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_META[f.status].dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium text-muted">{f.category}</span>
          <span className="block text-[14px] font-semibold leading-snug">{f.title}</span>
        </span>
        <ChevronRight size={15} className={cx('mt-1 text-muted transition-transform', open && 'rotate-90')} aria-hidden />
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-5 text-[13px] fade-in">
          {f.trigger && (
            <div>
              <h4 className="text-[11.5px] font-medium text-muted">Detected wording</h4>
              <p className="mt-0.5 font-medium">
                “{f.trigger}”
                {f.triggerDe && f.triggerDe !== f.trigger && <span className="font-normal text-muted"> · DE “{f.triggerDe}”</span>}
              </p>
            </div>
          )}

          <div>
            <h4 className="text-[11.5px] font-medium text-muted">{evidence.length ? 'Supporting evidence provided' : 'Supporting evidence'}</h4>
            {evidence.length ? (
              <ul className="mt-1 space-y-1.5">
                {evidence.map((e) => (
                  <li key={e.id} className="rounded-md border border-ok-line/60 bg-ok-soft/50 px-2.5 py-2">
                    <div className="font-medium text-ok">
                      {e.title} <span className="font-normal text-muted">· {kindLabel(e.kind)}{e.jurisdiction !== 'n/a' && ` · ${e.jurisdiction}`}</span>
                    </div>
                    <div className="text-[12.5px] text-ink-2">{e.details}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-muted">None of the evidence provided covers this statement.</p>
            )}
          </div>

          {f.missing.length > 0 && (
            <div>
              <h4 className="text-[11.5px] font-medium text-muted">Missing information</h4>
              <ul className="mt-1 space-y-1">
                {f.missing.map((m) => (
                  <li key={m} className="flex gap-1.5 text-warn">
                    <FileWarning size={14} className="mt-0.5 shrink-0" aria-hidden /> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {f.sourceRefs.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                <BookOpen size={12} aria-hidden /> Relevant official reference
              </h4>
              <ul className="mt-1.5 space-y-2">
                {f.sourceRefs.map((r) => {
                  const p = getProvision(r.sourceId, r.provisionId);
                  if (!p) return null;
                  return (
                    <li key={r.sourceId + r.provisionId} className="rounded-md border border-line bg-canvas/70 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12.5px] font-semibold">
                          {p.source.shortName}, {p.provision.label}
                        </span>
                        <a href={p.source.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-teal hover:underline">
                          EUR-Lex <ExternalLink size={11} aria-hidden />
                          <span className="sr-only">(opens in new tab)</span>
                        </a>
                      </div>
                      <blockquote className="mt-1.5 border-l-2 border-line-2 pl-2.5 text-[12.5px] leading-relaxed text-ink-2">{p.provision.excerpt}</blockquote>
                      <div className="mt-1.5 text-[11px] text-muted">Verbatim excerpt · {p.source.publication} · checked {p.source.checkedOn}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {f.sourceGap && (
            <div className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              <strong className="font-semibold">Unable to verify · expert review required.</strong> {f.sourceGap}
            </div>
          )}

          <div>
            <h4 className="text-[11.5px] font-medium text-muted">Assessment</h4>
            <p className="mt-0.5 leading-relaxed text-ink-2">{f.explanation}</p>
            <p className="mt-1 text-[11px] text-muted">Written by ProofLingo rule {f.ruleId}. This is not legal text.</p>
          </div>

          <div>
            <h4 className="text-[11.5px] font-medium text-muted">Suggested next action</h4>
            <p className="mt-0.5 flex gap-1.5 font-medium">
              <ArrowRight size={14} className="mt-0.5 shrink-0 text-teal" aria-hidden /> {f.suggestedAction}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
