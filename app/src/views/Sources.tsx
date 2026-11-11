import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ExternalLink, ShieldQuestion } from 'lucide-react';
import { KNOWN_SOURCE_GAPS, SOURCES, type RegulatorySource } from '../../../regulatory/sources';
import { RULES } from '../../../trust/rules';
import { useStore } from '../state/store';
import { Card, cx } from '../components/ui';

export function SourcesView() {
  const { state } = useStore();
  const findings = state.validation?.findings ?? [];
  const uses = (sourceId: string, provisionId: string) =>
    findings.filter((f) => f.sourceRefs.some((r) => r.sourceId === sourceId && r.provisionId === provisionId)).length;
  const quoteCount = SOURCES.reduce((n, s) => n + s.provisions.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-6 sm:p-7">
        <p className="text-[14px] font-medium text-muted">Where our checks come from</p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
          {SOURCES.length} EU regulations · {quoteCount} exact quotes
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['Word for word', 'Copied from the EU’s official law site. No AI rewording.'],
            ['Kept separate', 'Our explanations are labelled and never mixed into the law text.'],
            ['Honest gaps', 'If no source covers a topic, we say “can’t verify”.'],
          ].map(([t, b]) => (
            <li key={t} className="flex gap-3 rounded-xl bg-fill p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-ok">
                <Check size={15} strokeWidth={2.6} aria-hidden />
              </span>
              <span>
                <span className="block text-[14px] font-semibold text-ink">{t}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{b}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {SOURCES.map((s) => (
            <SourceCard key={s.id} source={s} uses={uses} />
          ))}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-[16px] font-semibold text-ink">Not covered yet</h3>
            <p className="mt-1 text-[13.5px] text-muted">Statements on these topics go to an expert.</p>
            <ul className="mt-4 space-y-4">
              {Object.values(KNOWN_SOURCE_GAPS).map((g) => (
                <li key={g} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                    <ShieldQuestion size={16} aria-hidden />
                  </span>
                  <span className="text-[13.5px] leading-relaxed text-ink-2">{g}</span>
                </li>
              ))}
            </ul>
          </Card>
          <RulesCard />
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source: s, uses }: { source: RegulatorySource; uses: (sourceId: string, provisionId: string) => number }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex min-w-0 gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill text-ink">
            <BookOpen size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold text-ink">{s.shortName}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.title}</p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {s.publication} · checked {new Date(s.checkedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <a
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-fill px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-fill-2"
        >
          Open on EUR-Lex <ExternalLink size={14} aria-hidden />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      </div>
      <ul className="border-t border-line">
        {s.provisions.map((p, i) => (
          <Provision key={p.id} label={p.label} excerpt={p.excerpt} used={uses(s.id, p.id)} first={i === 0} />
        ))}
      </ul>
    </Card>
  );
}

function Provision({ label, excerpt, used, first }: { label: string; excerpt: string; used: number; first: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cx(!first && 'border-t border-line')}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-canvas">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-ink">{label}</span>
            {used > 0 && <span className="rounded-full bg-teal-soft px-2 py-px text-[12px] font-semibold text-teal-ink">Used in {used} check{used > 1 ? 's' : ''}</span>}
          </span>
          {!open && <span className="mt-1 block truncate text-[13.5px] text-muted">{excerpt}</span>}
        </span>
        <ChevronDown size={18} className={cx('mt-0.5 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <blockquote className="mx-6 mb-5 border-l-2 border-ink pl-4 text-[14.5px] leading-relaxed text-ink fade-in">“{excerpt}”</blockquote>
      )}
    </li>
  );
}

function RulesCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-6">
      <h3 className="text-[16px] font-semibold text-ink">How we check</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
        {RULES.length} fixed rules compare each sentence with your evidence and these sources. No AI decides the result.
      </p>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-4 flex items-center gap-1.5 text-[14px] font-semibold text-teal hover:underline">
        {open ? 'Hide the rules' : `See all ${RULES.length} rules`}
        <ChevronDown size={16} className={cx('transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ol className="mt-4 space-y-2.5 fade-in">
          {RULES.map((r, i) => (
            <li key={r.id} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-2">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}</span>
              {r.name}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
