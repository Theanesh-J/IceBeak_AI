import { ExternalLink, ShieldQuestion } from 'lucide-react';
import { KNOWN_SOURCE_GAPS, SOURCES } from '../domain/sources';
import { RULES } from '../domain/rules';
import { useStore } from '../state/store';
import { Card, SectionTitle } from '../components/ui';

export function SourcesView() {
  const { state } = useStore();
  const findings = state.validation?.findings ?? [];
  const citations = (sourceId: string, provisionId: string) =>
    findings.filter((f) => f.sourceRefs.some((r) => r.sourceId === sourceId && r.provisionId === provisionId)).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {SOURCES.map((s) => (
          <Card key={s.id} className="overflow-hidden">
            <div className="border-b border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold tracking-tight">{s.shortName}</h2>
                  <p className="mt-1 text-[13px] text-ink-2">{s.title}</p>
                  <p className="mt-1.5 text-[12px] text-muted">
                    {s.publication} · {s.publisher} · excerpts checked against the source on {s.checkedOn}
                  </p>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-2 px-3 py-1.5 text-[13px] font-medium text-teal hover:bg-canvas"
                >
                  Open on EUR-Lex <ExternalLink size={13} aria-hidden />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {s.provisions.map((p) => {
                const n = citations(s.id, p.id);
                return (
                  <li key={p.id} className="grid gap-2 px-5 py-4 md:grid-cols-[200px_minmax(0,1fr)]">
                    <div>
                      <div className="text-[13px] font-semibold">{p.label}</div>
                      <div className="mt-0.5 text-[12px] text-muted">{n ? `Cited by ${n} current finding${n > 1 ? 's' : ''}` : 'Not cited in current check'}</div>
                    </div>
                    <blockquote className="border-l-2 border-line-2 pl-3 text-[13.5px] leading-relaxed text-ink-2">{p.excerpt}</blockquote>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <SectionTitle title="How sources are used" />
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-ink-2">
            <li>Excerpts are stored verbatim with their official URL. They are shown exactly as stored and never rewritten by a model.</li>
            <li>Explanations in TrustMap come from the rule engine. They are labelled as ProofLingo text and shown separately from the excerpts.</li>
            <li>Excerpts come from the original Official Journal texts. Later amendments, especially to the annexes of 1223/2009, are not included.</li>
            <li>If a topic has no curated source, the statement is marked <strong className="font-medium">Unable to verify</strong> and sent for expert review.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Known gaps" hint="Topics the engine recognises but cannot verify." />
          <ul className="mt-3 space-y-3">
            {Object.entries(KNOWN_SOURCE_GAPS).map(([k, v]) => (
              <li key={k} className="flex gap-2 text-[13px] text-ink-2">
                <ShieldQuestion size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden /> {v}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <SectionTitle title={`Rules (${RULES.length})`} hint="Deterministic checks. No model judges its own output." />
          <ol className="mt-3 space-y-1.5 text-[12.5px] text-ink-2">
            {RULES.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="w-8 shrink-0 font-mono text-[11.5px] text-muted">{r.id}</span>
                {r.name}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
