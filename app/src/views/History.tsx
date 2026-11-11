import { Download, FileJson, History as HistoryIcon, RefreshCw, Sparkles, PencilLine, Send, Package, ScanSearch } from 'lucide-react';
import { navigate } from '../App';
import { summarise } from '../../../trust/rules';
import type { HistoryEntry } from '../../../data/types';
import { buildMarkdownReport, download } from '../lib/report';
import { isStale, useStore } from '../state/store';
import { Button, Card, EmptyState, SectionTitle, cx, formatTime } from '../components/ui';

const ICON: Record<HistoryEntry['type'], typeof Sparkles> = {
  'product-loaded': Package,
  generated: Sparkles,
  validation: ScanSearch,
  revision: PencilLine,
  'manual-edit': PencilLine,
  decision: Send,
};

export function HistoryView() {
  const { state } = useStore();

  if (!state.history.length) {
    return (
      <EmptyState
        icon={<HistoryIcon size={18} />}
        title="No activity yet"
        body="Generations, checks, reviewer decisions and revisions will appear here with before-and-after text."
        action={<Button variant="primary" onClick={() => navigate('studio')}>Go to Launch Studio</Button>}
      />
    );
  }

  const canExport = !!state.content && !!state.validation;
  const slug = state.product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Evidence-linked change history" hint="Newest first. Each revision links to the findings that prompted it." />
        <ol className="mt-5 space-y-0">
          {state.history.map((h, i) => {
            const Icon = ICON[h.type];
            return (
              <li key={h.id} className="relative flex gap-3 pb-5">
                {i < state.history.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px bg-line" aria-hidden />}
                <span
                  className={cx(
                    'z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                    h.type === 'revision' || h.type === 'manual-edit' ? 'border-teal/30 bg-teal-soft text-teal' : 'border-line bg-surface text-muted',
                  )}
                >
                  <Icon size={13} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13.5px] font-medium">{h.summary}</span>
                    <time className="text-[12px] tabular-nums text-muted" dateTime={h.at}>
                      {formatTime(h.at)}
                    </time>
                  </div>
                  {h.type === 'validation' && h.resolved && h.resolved.length > 0 && (
                    <p className="mt-1 text-[12.5px] text-ok">Resolved since previous check: {h.resolved.length} finding(s) · {h.stillOpen} still open</p>
                  )}
                  {h.before && h.after && (
                    <div className="mt-2 grid gap-2 rounded-lg border border-line p-3 text-[13px] sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Before</div>
                        <p lang="de" className="mt-1 text-bad line-through decoration-bad/40">{h.before.de}</p>
                        <p lang="en" className="mt-0.5 text-[12px] text-muted">{h.before.en}</p>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">After</div>
                        <p lang="de" className="mt-1 text-ok">{h.after.de || '(statement removed)'}</p>
                        <p lang="en" className="mt-0.5 text-[12px] text-muted">{h.after.en}</p>
                      </div>
                      {h.findingIds && h.findingIds.length > 0 && (
                        <p className="text-[11.5px] text-muted sm:col-span-2">Addresses findings: {h.findingIds.map((f) => f.split(':')[0]).join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <SectionTitle title="Export review report" hint="Statements, findings, references, decisions and history." />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={!canExport}
              onClick={() => download(`prooflingo-${slug}-review.md`, buildMarkdownReport(state), 'text/markdown')}
            >
              <Download size={14} aria-hidden /> Markdown report
            </Button>
            <Button
              disabled={!canExport}
              onClick={() =>
                download(
                  `prooflingo-${slug}-review.json`,
                  JSON.stringify({ product: state.product, content: state.content, validation: state.validation, decisions: state.decisions, history: state.history }, null, 2),
                  'application/json',
                )
              }
            >
              <FileJson size={14} aria-hidden /> JSON
            </Button>
          </div>
          {canExport && isStale(state) && <p className="mt-2 text-[12px] text-warn">Content changed after the last check; the report will say so. Re-run checks first for an up-to-date report.</p>}
          {!canExport && <p className="mt-2 text-[12px] text-muted">Generate content first.</p>}
        </Card>
        <Evaluation />
      </div>
    </div>
  );
}

function Evaluation() {
  const { state } = useStore();
  if (!state.baseline || !state.validation || !state.content) return null;
  const b = state.baseline;
  const now = summarise(state.validation.findings, state.content.segments);
  const rows: Array<[string, string, string]> = [
    ['Statements published', `${b.statements}`, `${state.content.segments.length}`],
    ['Blocking problems shipped unflagged', `${b.blocked}`, '0'],
    ['Statements missing evidence, shipped unflagged', `${b.review}`, '0'],
    ['Blocking problems still open', '—', `${now.blocked}`],
    ['Routed to human / expert review', '0', `${now.review}`],
  ];
  return (
    <Card className="p-5">
      <SectionTitle title="Unchecked baseline vs verified pipeline" hint="Computed from this session's checks, not from benchmarks." />
      <table className="mt-4 w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wide text-muted">
            <th className="pb-2 font-medium" scope="col"></th>
            <th className="pb-2 pl-3 text-right font-medium" scope="col">Unchecked</th>
            <th className="pb-2 pl-3 text-right font-medium" scope="col">TrustMap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, a, c]) => (
            <tr key={label}>
              <th scope="row" className="py-2 pr-2 text-left font-normal text-ink-2">{label}</th>
              <td className="py-2 text-right tabular-nums">{a}</td>
              <td className="py-2 text-right font-medium tabular-nums">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        “Unchecked” means publishing the first generated text as-is. That is the same text before any rule ran. “TrustMap” is the current state after review.
      </p>
      {isStale(state) && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warn">
          <RefreshCw size={12} aria-hidden /> Re-run checks in TrustMap to refresh these numbers.
        </p>
      )}
    </Card>
  );
}
