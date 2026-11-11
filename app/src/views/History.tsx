import { useState } from 'react';
import { ArrowDown, ChevronDown, Download, FileJson, History as HistoryIcon, Package, PencilLine, ScanSearch, Send, Sparkles } from 'lucide-react';
import { navigate } from '../App';
import { summarise } from '../../../trust/rules';
import type { HistoryEntry } from '../../../data/types';
import { buildMarkdownReport, download } from '../lib/report';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, cx, formatTime } from '../components/ui';

const ICON: Record<HistoryEntry['type'], { Icon: typeof Sparkles; tone: string }> = {
  'product-loaded': { Icon: Package, tone: 'bg-fill text-ink-2' },
  generated: { Icon: Sparkles, tone: 'bg-fill text-ink-2' },
  validation: { Icon: ScanSearch, tone: 'bg-fill text-ink-2' },
  revision: { Icon: PencilLine, tone: 'bg-ok-soft text-ok' },
  'manual-edit': { Icon: PencilLine, tone: 'bg-ok-soft text-ok' },
  decision: { Icon: Send, tone: 'bg-warn-soft text-warn' },
};

export function HistoryView() {
  const { state } = useStore();

  if (!state.history.length) {
    return (
      <EmptyState
        icon={<HistoryIcon size={18} />}
        title="No activity yet"
        body="Everything you create, check, fix or send to an expert will show up here."
        action={
          <Button variant="primary" onClick={() => navigate('studio')}>
            Go to Launch Studio
          </Button>
        }
      />
    );
  }

  const h = state.history;
  const fixes = h.filter((e) => e.type === 'revision' || e.type === 'manual-edit').length;
  const experts = h.filter((e) => e.type === 'decision' && e.decision === 'escalated').length;
  const checks = h.filter((e) => e.type === 'validation').length;
  const canExport = !!state.content && !!state.validation;
  const slug = state.product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-medium text-muted">Your review so far</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">{state.product.name || 'Product'}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="lg" disabled={!canExport} onClick={() => download(`prooflingo-${slug}-review.md`, buildMarkdownReport(state), 'text/markdown')}>
              <Download size={17} aria-hidden /> Download report
            </Button>
            <Button
              size="lg"
              disabled={!canExport}
              aria-label="Download JSON"
              title="Download JSON"
              onClick={() =>
                download(
                  `prooflingo-${slug}-review.json`,
                  JSON.stringify({ product: state.product, content: state.content, validation: state.validation, decisions: state.decisions, history: state.history }, null, 2),
                  'application/json',
                )
              }
            >
              <FileJson size={17} aria-hidden />
            </Button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            [fixes, fixes === 1 ? 'fix applied' : 'fixes applied'],
            [experts, 'sent to an expert'],
            [checks, checks === 1 ? 'check run' : 'checks run'],
          ].map(([n, label]) => (
            <div key={label as string} className="rounded-xl bg-fill p-4">
              <dt className="sr-only">{label}</dt>
              <dd className="text-[28px] font-semibold leading-none tabular-nums text-ink">{n}</dd>
              <dd className="mt-1.5 text-[13px] text-muted">{label}</dd>
            </div>
          ))}
        </dl>
        {canExport && isStale(state) && <p className="mt-4 text-[13px] text-warn">Some text changed after the last check. The report will say so.</p>}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Activity feed */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h3 className="text-[16px] font-semibold text-ink">Activity</h3>
          </div>
          <ul>
            {h.map((e, i) => (
              <Activity key={e.id} entry={e} first={i === 0} />
            ))}
          </ul>
        </Card>

        <Comparison />
      </div>
    </div>
  );
}

function Activity({ entry: e, first }: { entry: HistoryEntry; first: boolean }) {
  const [open, setOpen] = useState(false);
  const { Icon, tone } = ICON[e.type];
  const expandable = !!(e.before && e.after);
  const cut = e.summary.indexOf(' · ');
  const title = cut < 0 ? e.summary : e.summary.slice(0, cut);
  const detail = cut < 0 ? undefined : e.summary.slice(cut + 3);
  const Tag = expandable ? 'button' : 'div';
  return (
    <li className={cx(!first && 'border-t border-line')}>
      <Tag
        {...(expandable ? { onClick: () => setOpen(!open), 'aria-expanded': open } : {})}
        className={cx('flex w-full items-center gap-4 px-6 py-4 text-left', expandable && 'transition-colors hover:bg-canvas')}
      >
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone)}>
          <Icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">{title}</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {e.type === 'validation' && e.resolved?.length ? `${e.resolved.length} problem${e.resolved.length > 1 ? 's' : ''} fixed · ` : ''}
            {detail}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <time className="block text-[13px] tabular-nums text-muted" dateTime={e.at}>
            {formatTime(e.at)}
          </time>
        </span>
        {expandable && <ChevronDown size={17} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />}
      </Tag>
      {open && e.before && e.after && (
        <div className="mx-6 mb-5 ml-[80px] rounded-xl bg-fill p-4 fade-in">
          <p lang="de" className="text-[14px] text-bad line-through decoration-bad/40">
            {e.before.de}
          </p>
          <ArrowDown size={15} className="my-2 text-muted" aria-hidden />
          <p lang="de" className="text-[14.5px] font-semibold text-ink">
            {e.after.de || '(sentence removed)'}
          </p>
          {e.after.en && <p className="mt-1 text-[13px] text-muted">{e.after.en}</p>}
        </div>
      )}
    </li>
  );
}

function Comparison() {
  const { state } = useStore();
  if (!state.baseline || !state.validation || !state.content) return null;
  const b = state.baseline;
  const now = summarise(state.validation.findings, state.content.segments);
  return (
    <Card className="self-start p-6">
      <h3 className="text-[16px] font-semibold text-ink">What ProofLingo changed</h3>
      <p className="mt-1 text-[13.5px] text-muted">From this session, not a benchmark.</p>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-[13px] font-medium text-muted">If you published the first draft as is</p>
          <p className="mt-2 text-[15px] text-ink">
            <span className="text-[22px] font-semibold tabular-nums text-bad">{b.blocked}</span> sentences with critical problems
          </p>
          <p className="mt-1 text-[15px] text-ink">
            <span className="text-[22px] font-semibold tabular-nums text-warn">{b.review}</span> unchecked items, live
          </p>
        </div>
        <div className="flex justify-center" aria-hidden>
          <ArrowDown size={16} className="text-muted" />
        </div>
        <div className="rounded-xl bg-fill p-4">
          <p className="text-[13px] font-medium text-muted">With ProofLingo, right now</p>
          <p className="mt-2 text-[15px] text-ink">
            <span className="text-[22px] font-semibold tabular-nums text-ink">{now.blocked}</span> {now.blocked === 1 ? 'sentence' : 'sentences'} still to fix
          </p>
          <p className="mt-1 text-[15px] text-ink">
            <span className="text-[22px] font-semibold tabular-nums text-ink">{now.review}</span> flagged for an expert, not hidden
          </p>
        </div>
      </div>
    </Card>
  );
}
