// Builds localised content. Regulatory fact lines are always composed here,
// deterministically from product facts and evidence, in both modes.

import type { EvidenceItem, LocalisedContent, ProductInput, Segment } from '../data/types';
import { CATEGORY_DE, SAMPLE_INFO, SAMPLE_MARKETING, SAMPLE_REVISIONS, SAMPLE_TRANSLATIONS, normalise } from '../data/sample';

const UNTRANSLATED = '[Keine deutsche Fassung im Beispielmodus verfügbar]';

export function claimSegmentId(index: number) {
  return `ls-claim-${index + 1}`;
}

export function buildRegulatorySegments(product: ProductInput): Segment[] {
  const has = (kind: EvidenceItem['kind'], j?: EvidenceItem['jurisdiction']) =>
    product.evidence.find((e) => e.kind === kind && (!j || e.jurisdiction === j));

  const rp = has('eu-responsible-person');
  const euSafety = has('safety-report', 'EU');
  const ukSafety = has('safety-report', 'UK');
  const cpnp = has('cpnp-notification');

  return [
    {
      id: 'pi-content',
      docType: 'info',
      field: 'Nominal content',
      en: `Nominal content: ${product.size}`,
      de: `Nenninhalt: ${product.size}`,
      factKey: 'size',
      origin: 'deterministic',
    },
    {
      id: 'pi-inci',
      docType: 'info',
      field: 'Ingredients (INCI)',
      en: `Ingredients: ${product.ingredients}`,
      de: `Inhaltsstoffe: ${product.ingredients}`,
      factKey: 'ingredients',
      origin: 'deterministic',
    },
    {
      id: 'pi-rp',
      docType: 'info',
      field: 'EU Responsible Person',
      en: rp ? `EU Responsible Person: ${rp.title}` : 'EU Responsible Person: not yet designated',
      de: rp ? `Verantwortliche Person (EU): ${rp.title}` : 'Verantwortliche Person (EU): noch nicht benannt',
      factKey: 'responsiblePerson',
      origin: 'deterministic',
    },
    {
      id: 'pi-safety',
      docType: 'info',
      field: 'Safety assessment',
      en: euSafety
        ? `Safety assessment: ${euSafety.title}`
        : ukSafety
          ? 'Safety assessment: UK safety report on file; EU report not provided'
          : 'Safety assessment: not provided',
      de: euSafety
        ? `Sicherheitsbewertung: ${euSafety.title}`
        : ukSafety
          ? 'Sicherheitsbewertung: Britischer Sicherheitsbericht liegt vor; EU-Bericht nicht vorgelegt'
          : 'Sicherheitsbewertung: nicht vorgelegt',
      factKey: 'safetyReport',
      origin: 'deterministic',
    },
    {
      id: 'pi-cpnp',
      docType: 'info',
      field: 'CPNP notification',
      en: cpnp ? `EU CPNP notification: ${cpnp.title}` : 'EU CPNP notification: not yet submitted',
      de: cpnp ? `EU-CPNP-Notifizierung: ${cpnp.title}` : 'EU-CPNP-Notifizierung: noch nicht eingereicht',
      factKey: 'notification',
      origin: 'deterministic',
    },
  ];
}

function translateSample(en: string): { de: string; untranslated: boolean } {
  const hit = SAMPLE_TRANSLATIONS[normalise(en)];
  return hit ? { de: hit, untranslated: false } : { de: UNTRANSLATED, untranslated: true };
}

/** Sample-mode generation: prewritten translations + deterministic templates. No model involved. */
export function generateSampleContent(product: ProductInput): LocalisedContent {
  const claimKeys = new Set(product.claims.map(normalise));
  const catDe = CATEGORY_DE[normalise(product.category)] ?? product.category;

  const listing: Segment[] = [
    {
      id: 'ls-title',
      docType: 'listing',
      field: 'Title',
      en: `${product.name}, ${product.size}`,
      de: `${product.name} – ${catDe}, ${product.size}`,
      origin: 'deterministic',
    },
    {
      id: 'ls-desc',
      docType: 'listing',
      field: 'Short description',
      en: product.description,
      ...translateSample(product.description),
      origin: 'sample',
    },
    ...product.claims
      .filter((c) => c.trim())
      .map<Segment>((claim, i) => ({
        id: claimSegmentId(i),
        docType: 'listing',
        field: `Key benefit ${i + 1}`,
        en: claim.trim(),
        ...translateSample(claim),
        claimRef: normalise(claim),
        origin: 'sample',
      })),
    {
      id: 'ls-size',
      docType: 'listing',
      field: 'Size',
      en: product.size,
      de: product.size,
      factKey: 'size',
      origin: 'deterministic',
    },
  ];

  const marketing: Segment[] = SAMPLE_MARKETING.filter((s) => !s.claimRef || claimKeys.has(s.claimRef)).map((s) => ({
    ...s,
    origin: 'sample',
  }));

  const info: Segment[] = [
    {
      id: 'pi-name',
      docType: 'info',
      field: 'Product name',
      en: product.name,
      de: product.name,
      origin: 'deterministic',
    },
    ...SAMPLE_INFO.map<Segment>((s) => ({ ...s, origin: 'sample' })),
    ...buildRegulatorySegments(product),
  ];

  return {
    mode: 'sample',
    generatedAt: new Date().toISOString(),
    segments: [...listing, ...marketing, ...info],
  };
}

export function sampleRevisionFor(segment: Segment) {
  return SAMPLE_REVISIONS[segment.id] ?? (segment.claimRef ? SAMPLE_REVISIONS[`claim:${segment.claimRef}`] : undefined);
}
