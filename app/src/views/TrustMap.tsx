import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronRight, CircleCheck, Cpu, ExternalLink, Loader2, Pencil, RefreshCw, ScanSearch, Send, Trash2, X } from 'lucide-react';
import { navigate, useServer } from '../App';
import type { DocType, EvidenceStatus, Finding, Segment } from '../../../data/types';
import { STATUS_RANK, segmentStatus, summarise } from '../../../trust/rules';
import { getProvision } from '../../../regulatory/sources';
import { sampleRevisionFor } from '../../../localise/compose';
import { reviseWithAI } from '../lib/api';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, STATUS_META, StatusBadge, cx, formatTime, inputCls } from '../components/ui';
import { DocTabs } from './LocalisedContent';
import { kindLabel } from './LaunchStudio';

type Filter = 'all' | EvidenceStatus;

const DOC_NAME: Record<DocType, string> = { listing: 'Listing', marketing: 'Marketing', info: 'Product info' };

export function TrustMapView() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<DocType>(() => state.content?.segments.find((s) => s.id === state.selectedSegmentId)?.docType ?? 'listing');
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [filter, setFilter] = useState<Filter>('all');

  if (!state.content || !state.validation) {
    return (
      <EmptyState
        icon={<ScanSearch size={18} />}
        title="Nothing to check yet"
        body="Create the German content first. Every statement is checked as soon as it is written."
        action={
          <Button variant="primary" onClick={() => navigate('studio')}>
            Go to Launch Studio
          </Button>
        }
      />
    );
  }

  const { content, validation } = state;
  const findings = validation.findings;
  const counts = summarise(findings, content.segments);
  const statusOf = (id: string) => segmentStatus(findings, id);
  const selected = content.segments.find((s) => s.id === state.selectedSegmentId);
  const select = (s: Segment) => {
    dispatch({ type: 'select', segmentId: s.id });
    setTab(s.docType);
  };
  const firstBlocked = content.segments.find((s) => statusOf(s.id) === 'blocked');
  const blockedIn = (d: DocType) => content.segments.filter((s) => s.docType === d && statusOf(s.id) === 'blocked').length;

  return (
    <div className="space-y-5">
      <Verdict counts={counts} onFixFirst={firstBlocked ? () => select(firstBlocked) : undefined} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        {/* Document */}
        <Card className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-2 sm:px-5">
            <DocTabs value={tab} onChange={setTab} counts={{ listing: blockedIn('listing'), marketing: blockedIn('marketing'), info: blockedIn('info') }} />
            <div className="mb-2 flex rounded-md bg-canvas p-0.5 text-[13px]" role="group" aria-label="Language">
              {(['de', 'en'] as const).map((l) => (
                <button
                  key={l}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={cx('rounded px-2.5 py-1 font-medium', lang === l ? 'bg-surface shadow-sm' : 'text-muted hover:text-ink')}
                >
                  {l === 'de' ? 'German' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3 sm:px-5" role="group" aria-label="Show">
            {(['all', 'blocked', 'review', 'supported'] as const).map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors',
                  filter === f ? 'bg-ink text-white' : 'bg-canvas text-ink-2 hover:bg-line',
                )}
              >
                {f !== 'all' && <span className={cx('h-2 w-2 rounded-full', STATUS_META[f].dot)} aria-hidden />}
                {f === 'all' ? 'All' : STATUS_META[f].short}
                {f !== 'all' && <span className="tabular-nums opacity-70">{counts[f]}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-labelledby={`tab-${tab}`} lang={lang} className="p-4 sm:p-6">
            {content.segments
              .filter((s) => s.docType === tab)
              .map((s) => {
                const st = statusOf(s.id);
                const dim = filter !== 'all' && st !== filter;
                return (
                  <div key={s.id} className={cx('grid gap-1 py-2.5 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-5', dim && 'opacity-30')}>
                    <span className="pt-1 text-[13px] text-muted">{s.field}</span>
                    <p className={cx('text-[16px] leading-[1.75]', s.untranslated && lang === 'de' ? 'italic text-muted' : 'text-ink')}>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected?.id === s.id}
                        aria-label={`${s.field}: ${STATUS_META[st].short}. ${lang === 'de' ? s.de : s.en}`}
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
        </Card>

        {/* Inspector */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {selected ? <Inspector key={selected.id + state.contentVersion} segment={selected} onSelect={select} /> : <Pick />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Verdict ---------- */

function Verdict({ counts, onFixFirst }: { counts: ReturnType<typeof summarise>; onFixFirst?: () => void }) {
  const { state, dispatch } = useStore();
  const stale = isStale(state);
  const d = state.lastDiff;

  if (stale) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 border-warn-line bg-warn-soft px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">You changed the text.</h2>
          <p className="mt-0.5 text-[14px] text-ink-2">Run the checks again to see if the change fixed the problem.</p>
        </div>
        <Button variant="primary" className="h-10 px-4" onClick={() => dispatch({ type: 'runValidation' })}>
          <RefreshCw size={15} aria-hidden /> Re-run checks
        </Button>
      </Card>
    );
  }

  const blocked = counts.blocked;
  return (
    <Card className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={cx('mt-2 h-3 w-3 shrink-0 rounded-full', blocked ? 'bg-bad' : counts.review ? 'bg-[#d08a14]' : 'bg-ok')} aria-hidden />
          <div>
            <h2 className="text-[18px] font-semibold text-ink">
              {blocked ? `${blocked} statement${blocked > 1 ? 's' : ''} must be fixed before you publish.` : 'Nothing is blocked.'}
            </h2>
            <p className="mt-0.5 text-[14px] text-ink-2">
              {counts.review} need{counts.review === 1 ? 's' : ''} a specialist to check · {counts.supported} backed by your evidence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[12.5px] text-muted sm:inline">Checked {formatTime(state.validation!.ranAt)}</span>
          {onFixFirst && (
            <Button variant="primary" className="h-10 px-4" onClick={onFixFirst}>
              Fix the first one <ArrowRight size={15} aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {d && (
        <div className="mt-4 border-t border-line pt-3 text-[13.5px] fade-in" role="status">
          <span className="inline-flex items-center gap-1.5 font-medium text-ok">
            <CircleCheck size={15} aria-hidden /> Last change fixed {d.resolved.length} problem{d.resolved.length === 1 ? '' : 's'}
          </span>
          {d.added.length > 0 && <span className="ml-3 font-medium text-bad">{d.added.length} new problem{d.added.length > 1 ? 's' : ''}</span>}
          <span className="ml-1 text-muted">· Fixed means the check passes now. It is not legal approval.</span>
        </div>
      )}
    </Card>
  );
}

function Pick() {
  return (
    <Card className="p-6">
      <h2 className="text-[16px] font-semibold">Click any highlighted sentence</h2>
      <p className="mt-1 text-[14px] leading-relaxed text-muted">You’ll see why it got its colour, what evidence is missing, and how to fix it.</p>
      <ul className="mt-5 space-y-3 text-[14px]">
        {(['blocked', 'review', 'supported'] as const).map((s) => (
          <li key={s} className="flex items-start gap-3">
            <span className={cx('hl mt-0.5 inline-block h-4 w-7 shrink-0', `hl-${s}`)} aria-hidden />
            <span>
              <span className="font-medium text-ink">{STATUS_META[s].short}</span>
              <span className="text-muted"> · {STATUS_META[s].label}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
        Colours show how far your evidence covers each sentence. They are not legal approval, and fluent German doesn’t mean it is accurate.
      </p>
    </Card>
  );
}

/* ---------- Inspector ---------- */

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
  const all = state.validation!.findings;
  const findings = all.filter((f) => f.segmentId === segment.id).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const st = segmentStatus(all, segment.id);
  const open = findings.filter((f) => f.status !== 'supported');
  const top = findings[0];
  const changed = isStale(state) && state.validation!.snapshot?.[segment.id] !== `${segment.en}\n${segment.de}`;
  const missing = [...new Set(open.flatMap((f) => f.missing))];
  const evidence = state.product.evidence.filter((e) => findings.some((f) => f.evidenceUsed.includes(e.id)));
  const refs = [...new Map(findings.flatMap((f) => f.sourceRefs).map((r) => [r.sourceId + r.provisionId, r])).values()];
  const gaps = [...new Set(findings.map((f) => f.sourceGap).filter(Boolean))] as string[];
  const decision = open.map((f) => state.decisions[f.id]).find(Boolean);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ en: segment.en, de: segment.de });
  const [aiRevision, setAiRevision] = useState<{ en: string; de: string; rationale: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const revision = aiRevision ?? (open.length && !changed ? sampleRevisionFor(segment) : undefined);
  const linked = useMemo(() => {
    if (!segment.claimRef || !revision) return [];
    return state.content!.segments.filter(
      (s) => s.id !== segment.id && s.claimRef === segment.claimRef && segmentStatus(all, s.id) === 'blocked' && sampleRevisionFor(s),
    );
  }, [segment, revision, state.content, all]);
  const [applyLinked, setApplyLinked] = useState(true);

  const approve = () => {
    if (!revision) return;
    const edits = [{ segmentId: segment.id, en: revision.en, de: revision.de }];
    const ids = open.map((f) => f.id);
    if (applyLinked)
      for (const s of linked) {
        const r = sampleRevisionFor(s)!;
        edits.push({ segmentId: s.id, en: r.en, de: r.de });
        ids.push(...all.filter((f) => f.segmentId === s.id && f.status !== 'supported').map((f) => f.id));
      }
    dispatch({ type: 'reviseSegments', edits, decision: 'revision-applied', findingIds: ids, note: revision.rationale });
  };

  const draftWithAI = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      setAiRevision(await reviseWithAI(state.product, segment, open));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not draft a fix.');
    } finally {
      setAiBusy(false);
    }
  };

  const next = () => {
    const list = state.content!.segments.filter((s) => ['blocked', 'review'].includes(segmentStatus(all, s.id)));
    if (list.length) onSelect(list[(list.findIndex((s) => s.id === segment.id) + 1) % list.length]);
  };

  return (
    <Card className="fade-in overflow-hidden">
      {/* 1. The statement */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <StatusBadge status={st} />
            <span className="truncate text-[13px] text-muted">
              {DOC_NAME[segment.docType]} · {segment.field}
            </span>
          </div>
          <div className="flex shrink-0">
            <Button variant="ghost" size="sm" onClick={next}>
              Next <ChevronRight size={14} aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'select', segmentId: undefined })} aria-label="Close">
              <X size={15} aria-hidden />
            </Button>
          </div>
        </div>
        <p lang="de" className="mt-4 text-[18px] font-medium leading-snug text-ink">
          {highlight(segment.de, open.map((f) => f.triggerDe ?? ''))}
        </p>
        <p lang="en" className="mt-1.5 text-[14px] leading-relaxed text-muted">
          {highlight(segment.en, open.map((f) => f.trigger ?? ''))}
        </p>
      </div>

      {changed ? (
        <div className="border-t border-line bg-warn-soft/60 p-5 sm:p-6">
          <p className="text-[14px] font-medium text-ink">This sentence was changed.</p>
          <p className="mt-0.5 text-[13.5px] text-ink-2">Run the checks again to see its new colour.</p>
          <Button variant="primary" className="mt-3" onClick={() => dispatch({ type: 'runValidation' })}>
            <RefreshCw size={14} aria-hidden /> Re-run checks
          </Button>
        </div>
      ) : (
        <>
          {/* 2. Why */}
          <div className="border-t border-line p-5 sm:p-6">
            <h3 className="text-[13px] font-medium text-muted">{st === 'supported' ? 'Why it’s OK' : st === 'none' ? 'Nothing to check' : 'Why it’s flagged'}</h3>
            {top ? (
              <>
                <p className="mt-1 text-[15px] font-semibold text-ink">{top.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{top.explanation}</p>
                {open.length > 1 && <p className="mt-2 text-[13px] text-muted">+ {open.length - 1} more problem{open.length > 2 ? 's' : ''} in this sentence (see all checks below).</p>}
              </>
            ) : (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">This sentence makes no product claim, so there is no evidence to check.</p>
            )}

            {missing.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[13px] font-medium text-muted">Missing</h4>
                <ul className="mt-1 space-y-1">
                  {missing.map((m) => (
                    <li key={m} className="flex gap-2 text-[14px] text-ink">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d08a14]" aria-hidden /> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gaps.length > 0 && (
              <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-[13px] leading-relaxed text-warn">
                <strong className="font-semibold">Can’t verify:</strong> no source for this topic is loaded. A specialist needs to check it.
              </p>
            )}
            {st === 'supported' && <p className="mt-3 text-[13px] text-muted">Backed by your evidence. This is not legal approval of the wording.</p>}
          </div>

          {/* 3. Fix */}
          {open.length > 0 && (
            <div className="border-t border-line bg-canvas/70 p-5 sm:p-6">
              <h3 className="text-[13px] font-medium text-muted">{revision ? 'Suggested fix' : 'What you can do'}</h3>
              {decision && <p className="mt-1 text-[13px] text-teal-ink">✓ {decision.decision === 'escalated' ? 'Sent to a specialist' : 'Decision recorded'} at {formatTime(decision.at)}</p>}

              {revision && !editing && (
                <div className="mt-2 rounded-lg border border-teal/30 bg-surface p-4">
                  <p lang="de" className="text-[16px] font-medium leading-snug text-ink">{revision.de}</p>
                  <p lang="en" className="mt-1 text-[13.5px] text-muted">{revision.en}</p>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{revision.rationale}</p>
                  <p className="mt-2 text-[12px] text-muted">{aiRevision ? `Drafted by ${server?.model ?? 'the model'}` : 'Prewritten example fix'} · checked again after you approve</p>
                  {linked.length > 0 && (
                    <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-line pt-3 text-[13px] text-ink-2">
                      <input type="checkbox" className="mt-0.5 accent-teal" checked={applyLinked} onChange={(e) => setApplyLinked(e.target.checked)} />
                      <span>Also fix the same claim in {linked.map((l) => `${DOC_NAME[l.docType]} · ${l.field}`).join(', ')}</span>
                    </label>
                  )}
                </div>
              )}

              {editing ? (
                <div className="mt-2 space-y-2">
                  <label className="block text-[13px] font-medium text-muted" htmlFor="edit-de">German</label>
                  <textarea id="edit-de" lang="de" rows={2} className={inputCls} value={draft.de} onChange={(e) => setDraft({ ...draft, de: e.target.value })} />
                  <label className="block text-[13px] font-medium text-muted" htmlFor="edit-en">English</label>
                  <textarea id="edit-en" rows={2} className={inputCls} value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="primary"
                      disabled={!draft.en.trim() || !draft.de.trim()}
                      onClick={() => {
                        dispatch({ type: 'reviseSegments', edits: [{ segmentId: segment.id, ...draft }], decision: 'edited-manually', findingIds: open.map((f) => f.id) });
                        setEditing(false);
                      }}
                    >
                      Save
                    </Button>
                    <Button onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {revision && (
                    <Button variant="primary" className="h-10 px-4" onClick={approve}>
                      <Check size={15} aria-hidden /> Approve fix
                    </Button>
                  )}
                  {state.content!.mode === 'ai' && server?.configured && (
                    <Button onClick={draftWithAI} disabled={aiBusy}>
                      {aiBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Cpu size={14} aria-hidden />}
                      {aiBusy ? 'Drafting…' : aiRevision ? 'Try another fix' : 'Suggest a fix with AI'}
                    </Button>
                  )}
                  <Button onClick={() => setEditing(true)}>
                    <Pencil size={14} aria-hidden /> Edit myself
                  </Button>
                  {st === 'review' && (
                    <Button onClick={() => dispatch({ type: 'decide', segmentId: segment.id, findingIds: open.map((f) => f.id), decision: 'escalated' })}>
                      <Send size={14} aria-hidden /> Send to specialist
                    </Button>
                  )}
                  {!segment.factKey && (
                    <Button variant="ghost" className="text-bad hover:bg-bad-soft" onClick={() => dispatch({ type: 'removeSegment', segmentId: segment.id, findingIds: open.map((f) => f.id) })}>
                      <Trash2 size={14} aria-hidden /> Remove
                    </Button>
                  )}
                </div>
              )}
              {aiError && (
                <p role="alert" className="mt-2 text-[13px] text-bad">
                  {aiError}
                </p>
              )}
              {st === 'blocked' && !editing && <p className="mt-3 text-[12.5px] text-muted">Blocked sentences can’t be approved as they are.</p>}
              {segment.factKey && !editing && <p className="mt-3 text-[12.5px] text-muted">This line comes from your product facts. Add the missing evidence in Launch Studio, then generate again.</p>}
            </div>
          )}

          {/* 4. Details */}
          {(refs.length > 0 || evidence.length > 0) && (
            <Disclosure title={`Evidence and law (${evidence.length + refs.length})`}>
              {evidence.length > 0 && (
                <>
                  <h4 className="text-[13px] font-medium text-muted">Your evidence used</h4>
                  <ul className="mt-1.5 space-y-2">
                    {evidence.map((e) => (
                      <li key={e.id} className="rounded-md bg-ok-soft/60 px-3 py-2 text-[13.5px]">
                        <span className="font-medium text-ok">{e.title}</span>
                        <span className="text-muted"> · {kindLabel(e.kind)}</span>
                        <p className="mt-0.5 text-[13px] text-ink-2">{e.details}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {refs.length > 0 && (
                <>
                  <h4 className={cx('text-[13px] font-medium text-muted', evidence.length > 0 && 'mt-4')}>What the law says</h4>
                  <ul className="mt-1.5 space-y-2.5">
                    {refs.map((r) => {
                      const p = getProvision(r.sourceId, r.provisionId);
                      if (!p) return null;
                      return (
                        <li key={r.sourceId + r.provisionId}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-semibold">
                              {p.source.shortName}, {p.provision.label}
                            </span>
                            <a href={p.source.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-teal hover:underline">
                              EUR-Lex <ExternalLink size={11} aria-hidden />
                              <span className="sr-only">(opens in new tab)</span>
                            </a>
                          </div>
                          <blockquote className="mt-1 border-l-2 border-line-2 pl-3 text-[13px] leading-relaxed text-ink-2">{p.provision.excerpt}</blockquote>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-[11.5px] text-muted">Exact quotes from the Official Journal, checked on EUR-Lex.</p>
                </>
              )}
              {gaps.map((g) => (
                <p key={g} className="mt-3 text-[12.5px] text-muted">
                  {g}
                </p>
              ))}
            </Disclosure>
          )}
          {findings.length > 0 && (
            <Disclosure title={`All checks on this sentence (${findings.length})`}>
              <ul className="space-y-3">
                {findings.map((f) => (
                  <CheckRow key={f.id} f={f} />
                ))}
              </ul>
            </Disclosure>
          )}
        </>
      )}
    </Card>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[14px] font-medium text-ink hover:bg-canvas/60 sm:px-6">
        {title}
        <ChevronDown size={16} className={cx('text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="px-5 pb-5 fade-in sm:px-6">{children}</div>}
    </div>
  );
}

function CheckRow({ f }: { f: Finding }) {
  return (
    <li className="flex gap-3">
      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_META[f.status].dot)} aria-hidden />
      <div className="min-w-0 text-[13.5px]">
        <div className="font-medium text-ink">{f.title}</div>
        <div className="text-[12.5px] text-muted">
          {f.category} · rule {f.ruleId}
          {f.trigger && ` · “${f.trigger}”`}
        </div>
        <div className="mt-0.5 text-ink-2">→ {f.suggestedAction}</div>
      </div>
    </li>
  );
}
