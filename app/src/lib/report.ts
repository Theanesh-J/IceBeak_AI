import type { AppState } from '../state/store';
import { segmentStatus } from '../domain/rules';
import { getProvision } from '../domain/sources';
import { SAMPLE_COMPANY } from '../domain/sample';

const STATUS_TEXT = {
  supported: 'Supported by provided evidence',
  review: 'Missing evidence / requires review',
  blocked: 'Blocked',
  none: 'No claim detected',
} as const;

export function buildMarkdownReport(state: AppState): string {
  const c = state.content!;
  const v = state.validation!;
  const lines: string[] = [];
  lines.push(`# ProofLingo review report`);
  lines.push('');
  lines.push(`- Company: ${SAMPLE_COMPANY.name}`);
  lines.push(`- Product: ${state.product.name} (${state.product.size})`);
  lines.push(`- Route: ${SAMPLE_COMPANY.homeMarket} → ${SAMPLE_COMPANY.destination}`);
  lines.push(`- Generation mode: ${c.mode === 'ai' ? `Connected AI (${c.model})` : 'Sample scenario (prewritten content, no model inference)'}`);
  lines.push(`- Last check: ${v.ranAt} · ${v.rulesRun.length} deterministic rules${v.contentVersion !== state.contentVersion ? ' · WARNING: content changed after this check' : ''}`);
  lines.push('');
  lines.push(
    '> Statuses describe how far the evidence provided covers each statement. They are not a legal opinion and do not certify compliance. Items marked for review require a qualified human expert.',
  );
  lines.push('');

  for (const doc of ['listing', 'marketing', 'info'] as const) {
    lines.push(`## ${doc === 'listing' ? 'Product listing' : doc === 'marketing' ? 'Marketing' : 'Product information'}`);
    lines.push('');
    for (const s of c.segments.filter((x) => x.docType === doc)) {
      const st = segmentStatus(v.findings, s.id);
      lines.push(`### ${s.field} — ${STATUS_TEXT[st]}`);
      lines.push(`- EN: ${s.en}`);
      lines.push(`- DE: ${s.de}`);
      for (const f of v.findings.filter((x) => x.segmentId === s.id)) {
        lines.push(`- [${f.status.toUpperCase()}] ${f.category}: ${f.title} (rule ${f.ruleId})`);
        lines.push(`  - Assessment: ${f.explanation}`);
        if (f.missing.length) lines.push(`  - Missing: ${f.missing.join('; ')}`);
        for (const r of f.sourceRefs) {
          const p = getProvision(r.sourceId, r.provisionId);
          if (p) lines.push(`  - Reference: ${p.source.shortName}, ${p.provision.label} — ${p.source.url}`);
        }
        if (f.sourceGap) lines.push(`  - Unable to verify: ${f.sourceGap}`);
        lines.push(`  - Next action: ${f.suggestedAction}`);
        const d = state.decisions[f.id];
        if (d) lines.push(`  - Reviewer decision: ${d.decision} at ${d.at}${d.note ? ` (${d.note})` : ''}`);
      }
      lines.push('');
    }
  }

  lines.push('## Change history');
  lines.push('');
  for (const h of [...state.history].reverse()) {
    lines.push(`- ${h.at} · ${h.summary}`);
    if (h.before && h.after) {
      lines.push(`  - Before (DE): ${h.before.de}`);
      lines.push(`  - After (DE): ${h.after.de || '(removed)'}`);
    }
  }
  return lines.join('\n');
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
