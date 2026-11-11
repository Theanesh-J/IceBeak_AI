// TrustMap validation engine.
//
// Deterministic: combines pattern-based claim detection, known product facts
// (size, INCI list) and the evidence the business supplied, then links each
// finding to curated source provisions. No language model is consulted, so a
// model cannot talk its way past a blocker.
//
// Status semantics describe EVIDENCE COVERAGE, never legal compliance:
//   supported – the statement is covered by evidence or product facts provided
//   review    – evidence is missing, or the topic needs human/expert judgement
//   blocked   – a critical, identified problem: must be revised before use

import type {
  EvidenceItem,
  EvidenceStatus,
  Finding,
  LocalisedContent,
  ProductInput,
  Segment,
  SourceRef,
} from '../data/types';
import { KNOWN_SOURCE_GAPS } from '../regulatory/sources';

const ref = (sourceId: 'eu-655-2013' | 'ec-1223-2009', provisionId: string): SourceRef => ({ sourceId, provisionId });
const R655 = (p: string) => ref('eu-655-2013', p);
const R1223 = (p: string) => ref('ec-1223-2009', p);

export const STATUS_RANK: Record<EvidenceStatus, number> = { supported: 0, review: 1, blocked: 2 };

export const RULES = [
  { id: 'R01', name: 'Clinical / medical-testing claims need clinical evidence' },
  { id: 'R02', name: 'Absolute or exaggerated performance promises' },
  { id: 'R03', name: 'Time-bound results need matching study duration' },
  { id: 'R04', name: 'Hydration claims need instrumental data with matching duration' },
  { id: 'R05', name: 'Sensory claims need perception or instrumental data' },
  { id: 'R06', name: 'Named ingredients must be in the INCI list (and concentrations evidenced)' },
  { id: 'R07', name: '“Free from” claims checked against INCI list' },
  { id: 'R08', name: 'Medicinal wording that may fall outside the cosmetic definition' },
  { id: 'R09', name: 'Authority approval or endorsement claims' },
  { id: 'R10', name: 'Skin-type suitability claims' },
  { id: 'R11', name: '“Natural” / origin claims' },
  { id: 'R12', name: 'Uniqueness claims' },
  { id: 'R13', name: 'Volumes match declared product size' },
  { id: 'R14', name: 'Numbers preserved between English and German' },
  { id: 'R15', name: 'Translation must not add claims absent from the source' },
  { id: 'R16', name: 'Untranslated segments' },
  { id: 'R17', name: 'Brand name preserved in German title' },
  { id: 'R18', name: 'EU market-entry prerequisites (Responsible Person, safety report, CPNP)' },
  { id: 'R19', name: 'INCI list matches product facts' },
  { id: 'R20', name: 'German label-language rules (national law)' },
] as const;

// ---------- pattern families (EN and DE detected independently) ----------

interface Family {
  key: string;
  en: RegExp;
  de: RegExp;
}

const F = {
  clinical: {
    key: 'clinical',
    en: /\bclinically\b|\bclinical(ly)?\s+(proven|tested|study|studies)\b|\bdermatologically tested\b/i,
    de: /\bklinisch\w*|\bdermatologisch\w* getestet\w*|\bdermatologisch\w* geprüft\w*/i,
  },
  absolute: {
    key: 'absolute',
    en: /\beliminat\w*|\berase\w*|\bpermanent\w*|\bforever\b|\b100\s?%|\bguarantee\w*|\binstant(ly)?\b|\bdisappear\w*/i,
    de: /\bbeseitig\w*|\beliminier\w*|\bdauerhaft\w*|\bgarantiert\w*|\bverschwind\w*|\bsofort\w*|\b100\s?%/i,
  },
  timebound: {
    key: 'timebound',
    en: /\b(in|within|after)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a)\s+(days?|weeks?)\b/i,
    de: /\b(in|innerhalb|nach)\s+(von\s+)?(\d+|einer|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(tag\w*|woche\w*)/i,
  },
  hydration: { key: 'hydration', en: /\bhydrat\w*/i, de: /\bfeuchtigkeit\b/i },
  perception: {
    key: 'perception',
    en: /\bfeel(s|ing)?\b[^.]*\b(soft\w*|smooth\w*|comfortable|supple)\b|\b(softer|smoother|suppler)[- ]feeling\b|\bcomfortable\b|\blooks?\s+(smoother|radiant|brighter)\b/i,
    de: /\bhautgefühl\w*|\bfühlt sich\b/i,
  },
  freeFrom: {
    key: 'freeFrom',
    en: /\b(fragrance|perfume|paraben|alcohol|sulphate|sulfate|silicone)[- ]free\b|\bfree (from|of)\b/i,
    de: /\b(parfüm|duftstoff|paraben|alkohol|silikon)\w*frei\w*|\bfrei von\b|\bohne (parfüm|duftstoffe|parabene)\b/i,
  },
  medical: {
    key: 'medical',
    en: /\b(treat(s|ing|ment|ments)?|cures?|heal(s|ing|ed)?|eczema|psoriasis|dermatitis|rosacea|acne|anti-inflammatory)\b/i,
    de: /\b(heilt|heilend\w*|behandel\w*|ekzem\w*|neurodermitis|schuppenflechte|akne|entzündungshemmend\w*)\b/i,
  },
  authority: {
    key: 'authority',
    en: /\b(approved|certified|authori[sz]ed|endorsed)\s+by\b|\b(dermatologist|doctor)[- ](approved|recommended)\b/i,
    de: /\bzugelassen\w*|\bempfohlen von\b|\bgeprüft von\b|\bvon (dermatologen|ärzten) empfohlen\w*/i,
  },
  sensitive: {
    key: 'sensitive',
    en: /\bsensitive skin\b|\bhypoallergenic\b|\bnon-irritating\b/i,
    de: /\bempfindliche\w* haut\b|\bhypoallergen\w*/i,
  },
  natural: {
    key: 'natural',
    en: /\bnatural\w*|\borganic\b|\bplant-based\b/i,
    de: /\bnatürlich\w*|\bbio\b|\bpflanzlich\w*/i,
  },
  unique: {
    key: 'unique',
    en: /\bunique\b|\bthe only\b|\bfirst[- ]ever\b|\bno\.\s?1\b|\bnumber one\b/i,
    de: /\beinzigartig\w*|\bdie einzige\b|\bals erste\w*\b/i,
  },
} satisfies Record<string, Family>;

const ESCALATION_FAMILIES: Family[] = [F.clinical, F.absolute, F.medical, F.authority, F.natural, F.unique, F.timebound];

interface Ingredient {
  label: string;
  terms: RegExp;
  inci: RegExp;
}

const INGREDIENT_TERMS: Ingredient[] = [
  { label: 'Niacinamide', terms: /\bniacinamid\w*/i, inci: /niacinamide/i },
  { label: 'Ceramides', terms: /\bceramid\w*/i, inci: /ceramide/i },
  { label: 'Oat', terms: /\boats?\b|\bhafer\b/i, inci: /avena sativa/i },
  { label: 'Hyaluronic acid', terms: /\bhyaluron\w*/i, inci: /hyaluron/i },
  { label: 'Squalane', terms: /\bsqualan\w*/i, inci: /squalane/i },
  { label: 'Panthenol', terms: /\bpanthenol\b/i, inci: /panthenol/i },
  { label: 'Vitamin E', terms: /\bvitamin e\b|\btocopherol\b/i, inci: /tocopher/i },
  { label: 'Retinol', terms: /\bretinol\b/i, inci: /retinol/i },
  { label: 'Vitamin C', terms: /\bvitamin c\b/i, inci: /ascorb/i },
  { label: 'Shea butter', terms: /\bshea\w*/i, inci: /butyrospermum|shea/i },
  { label: 'Aloe vera', terms: /\baloe\b/i, inci: /aloe/i },
  { label: 'Collagen', terms: /\bcollagen\b|\bkollagen\b/i, inci: /collagen/i },
  { label: 'Peptides', terms: /\bpeptid\w*/i, inci: /peptide/i },
];

const FREE_FROM_CONTRADICTIONS: Array<{ claim: RegExp; inci: RegExp; label: string }> = [
  { claim: /fragrance|perfume|parfüm|duftstoff/i, inci: /\bparfum\b|\bfragrance\b|\baroma\b|linalool|limonene|citronellol|geraniol/i, label: 'fragrance' },
  { claim: /paraben/i, inci: /paraben/i, label: 'parabens' },
  { claim: /silicone|silikon/i, inci: /dimethicone|siloxane|silicone/i, label: 'silicones' },
  { claim: /alcohol|alkohol/i, inci: /alcohol denat|\bethanol\b/i, label: 'drying alcohol' },
];

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
  zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12,
};

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(parseFloat(m[0].replace(',', '.')));
  for (const m of text.toLowerCase().matchAll(/\b[a-zäöüß]+\b/g)) {
    if (m[0] in NUMBER_WORDS) out.push(NUMBER_WORDS[m[0]]);
  }
  return out.sort((a, b) => a - b);
}

function volumes(text: string) {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s?(ml|g)\b/gi)].map((m) => `${parseFloat(m[1].replace(',', '.'))} ${m[2].toLowerCase()}`);
}

function match(fam: Family, seg: Segment) {
  const en = seg.en.match(fam.en)?.[0];
  const de = seg.untranslated ? undefined : seg.de.match(fam.de)?.[0];
  return { en, de, any: en ?? de };
}

const ofKind = (p: ProductInput, ...kinds: EvidenceItem['kind'][]) => p.evidence.filter((e) => kinds.includes(e.kind));
const mentions = (e: EvidenceItem, n: number, unit: RegExp) =>
  new RegExp(`\\b${n}\\s*(-\\s*)?${unit.source}`, 'i').test(`${e.title} ${e.details}`);

// ---------- engine ----------

export function validate(product: ProductInput, content: LocalisedContent): { findings: Finding[]; rulesRun: string[] } {
  const findings: Finding[] = [];
  const add = (seg: Segment, f: Omit<Finding, 'id' | 'segmentId'>, key?: string) => {
    const id = `${f.ruleId}:${seg.id}${key ? `:${key}` : ''}`;
    if (!findings.some((x) => x.id === id)) findings.push({ ...f, id, segmentId: seg.id });
  };
  const inci = product.ingredients;
  const productVolume = volumes(product.size)[0];

  for (const seg of content.segments) {
    // R01 clinical
    const clin = match(F.clinical, seg);
    if (clin.any) {
      const studies = ofKind(product, 'clinical-study');
      add(seg, {
        ruleId: 'R01',
        status: studies.length ? 'review' : 'blocked',
        category: 'Efficacy claim substantiation',
        title: studies.length ? 'Clinical claim needs expert check against the study' : 'Clinical claim with no clinical evidence',
        trigger: clin.any,
        triggerDe: clin.de,
        evidenceUsed: studies.map((s) => s.id),
        missing: studies.length ? [] : ['A clinical study of this product that measures the claimed benefit'],
        sourceRefs: [R655('c3-1'), R655('c3-3'), R655('c4-1')],
        explanation: studies.length
          ? 'A clinical study was provided, but the engine cannot judge whether its design, population and endpoints support this exact wording.'
          : 'It says “clinically proven”, but you have no clinical study. None of your evidence measures this result.',
        suggestedAction: studies.length
          ? 'Ask a claims specialist to confirm the study supports the wording.'
          : 'Remove the clinical claim, or attach a clinical study and rerun the checks.',
      });
    }

    // R02 absolute
    const abs = match(F.absolute, seg);
    if (abs.any) {
      add(seg, {
        ruleId: 'R02',
        status: 'blocked',
        category: 'Absolute or exaggerated performance',
        title: 'Absolute performance promise',
        trigger: abs.any,
        triggerDe: abs.de,
        evidenceUsed: [],
        missing: ['Evidence that the product fully achieves the stated outcome'],
        sourceRefs: [R655('c4-1'), R1223('art20-1')],
        explanation: `“${abs.any}” promises a total result. None of your evidence shows that, so the claim goes further than your proof.`,
        suggestedAction: 'Replace the absolute promise with a benefit the provided evidence actually measures.',
      });
    }

    // R03 time-bound
    const tb = match(F.timebound, seg);
    if (tb.any) {
      const nums = extractNumbers(tb.any);
      const unit = /week|woche/i.test(tb.any) ? /(weeks?|wochen?)/ : /(days?|tagen?)/;
      const covering = ofKind(product, 'clinical-study', 'instrumental-test').filter((e) => nums.some((n) => mentions(e, n, unit)));
      add(seg, {
        ruleId: 'R03',
        status: covering.length ? 'supported' : 'review',
        category: 'Time-bound performance claim',
        title: covering.length ? 'Timeframe matches a provided study' : 'Timeframe not covered by evidence',
        trigger: tb.any,
        triggerDe: tb.de,
        evidenceUsed: covering.map((e) => e.id),
        missing: covering.length ? [] : [`A study measuring the result at the stated timeframe (“${tb.any}”)`],
        sourceRefs: [R655('c3-3'), R655('c4-1')],
        explanation: covering.length
          ? 'A provided study reports measurements at this timeframe.'
          : 'No provided study reports measurements at this timeframe.',
        suggestedAction: covering.length ? 'No action needed for the timeframe.' : 'Remove the timeframe or attach a study with matching measurement points.',
      });
    }

    // R04 hydration
    const hy = match(F.hydration, seg);
    if (hy.any) {
      const hrsMatch = (seg.en.match(/(\d+)\s*-?\s*(hours?|h)\b/i) ?? seg.de.match(/(\d+)\s*(stunden|h)\b/i))?.[1];
      const instr = ofKind(product, 'instrumental-test').filter((e) => /hydrat|corneometer|moistur/i.test(`${e.title} ${e.details}`));
      const covering = hrsMatch ? instr.filter((e) => mentions(e, Number(hrsMatch), /(hours?|h\b|stunden)/)) : instr;
      const status: EvidenceStatus = covering.length ? 'supported' : instr.length ? 'blocked' : 'review';
      add(seg, {
        ruleId: 'R04',
        status,
        category: 'Hydration claim',
        title:
          status === 'supported'
            ? `Hydration claim covered${hrsMatch ? ` at ${hrsMatch} hours` : ''}`
            : status === 'blocked'
              ? 'Claimed duration exceeds measured duration'
              : 'Hydration claim without instrumental data',
        trigger: hy.any,
        triggerDe: hy.de,
        evidenceUsed: covering.map((e) => e.id),
        missing: status === 'supported' ? [] : [`Instrumental hydration data${hrsMatch ? ` at ${hrsMatch} hours` : ''}`],
        sourceRefs: [R655('c3-1'), R655('c4-1')],
        explanation:
          status === 'supported'
            ? `“${covering[0].title}” reports hydration measurements${hrsMatch ? ` at ${hrsMatch} hours` : ''}, which matches the claim.`
            : status === 'blocked'
              ? `Hydration data exists, but not at ${hrsMatch} hours. Presenting a longer duration than measured goes beyond the evidence.`
              : 'No instrumental hydration measurements were provided for this claim.',
        suggestedAction:
          status === 'supported' ? 'Keep the wording consistent with the study.' : 'Align the duration with the measured timepoints, or attach matching data.',
      });
    }

    // R05 perception
    const pe = match(F.perception, seg);
    if (pe.any) {
      // Every sensation named in the claim must be assessed by the same piece of evidence.
      const sensations = [...new Set([...seg.en.matchAll(/\b(soft|smooth|comfort|supple|radian|bright)\w*/gi)].map((m) => m[1].toLowerCase()))];
      const ev = ofKind(product, 'consumer-perception', 'instrumental-test').filter((e) =>
        (sensations.length ? sensations : ['feel']).every((w) => `${e.title} ${e.details}`.toLowerCase().includes(w)),
      );
      add(seg, {
        ruleId: 'R05',
        status: ev.length ? 'supported' : 'review',
        category: 'Sensory / perception claim',
        title: ev.length ? 'Sensory claim covered by perception data' : 'Sensory claim without perception data',
        trigger: pe.any,
        triggerDe: pe.de,
        evidenceUsed: ev.map((e) => e.id),
        missing: ev.length ? [] : ['A consumer perception or instrumental test covering this sensation'],
        sourceRefs: [R655('c3-1'), R655('c3-3')],
        explanation: ev.length
          ? `“${ev[0].title}” assessed the sensation described (${ev[0].details})`
          : 'No perception test covering this sensation was provided.',
        suggestedAction: ev.length ? 'No action needed.' : 'Attach consumer perception results or soften the wording.',
      });
    }

    // R06 ingredients
    for (const ing of INGREDIENT_TERMS) {
      const t = seg.en.match(ing.terms)?.[0] ?? (seg.untranslated ? undefined : seg.de.match(ing.terms)?.[0]);
      if (!t || seg.factKey === 'ingredients') continue;
      const present = ing.inci.test(inci);
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pct = (
        seg.en.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?%\\s+${esc}`, 'i')) ??
        seg.en.match(new RegExp(`${esc}\\s+(\\d+(?:[.,]\\d+)?)\\s?%`, 'i'))
      )?.[1];
      const spec = ofKind(product, 'ingredient-spec');
      const pctOk =
        !pct || spec.some((e) => new RegExp(`(${ing.inci.source})[^.,;]*?${pct.replace('.', '\\.')}\\s?%`, 'i').test(e.details));
      const status: EvidenceStatus = !present ? 'blocked' : pctOk ? 'supported' : 'review';
      add(seg, {
        ruleId: 'R06',
        status,
        category: 'Ingredient claim',
        title: !present ? `${ing.label} is not in the INCI list` : pct && pctOk ? `${ing.label} ${pct}% confirmed` : `${ing.label} present in INCI list`,
        trigger: t,
        evidenceUsed: pct && pctOk ? spec.map((e) => e.id) : [],
        missing: !present ? [`${ing.label} in the product’s ingredient list`] : pctOk ? [] : [`Formula specification confirming ${pct}%`],
        sourceRefs: pct ? [R655('c2-1'), R655('c3-6')] : [R655('c2-1')],
        explanation: !present
          ? `The text names ${ing.label}, but it does not appear in the INCI list supplied. Claimed ingredients must be deliberately present.`
          : pct && pctOk
            ? `${ing.label} is in the INCI list and the formula specification states ${pct}%.`
            : pct
              ? `${ing.label} is in the INCI list, but no specification confirms the ${pct}% concentration.`
              : `${ing.label} is in the INCI list supplied.`,
        suggestedAction: !present ? 'Remove the ingredient reference or correct the INCI list.' : pctOk ? 'No action needed.' : 'Attach the formula specification.',
      }, ing.label);
    }

    // R07 free-from
    const ff = match(F.freeFrom, seg);
    if (ff.any) {
      const contra = FREE_FROM_CONTRADICTIONS.find((c) => c.claim.test(ff.any!) && c.inci.test(inci));
      add(seg, {
        ruleId: 'R07',
        status: contra ? 'blocked' : 'review',
        category: 'Free-from claim',
        title: contra ? `INCI list contains ${contra.label}` : 'Consistent with INCI list — expert review required',
        trigger: ff.any,
        triggerDe: ff.de,
        evidenceUsed: ofKind(product, 'ingredient-spec').map((e) => e.id),
        missing: contra ? [] : ['Curated guidance on free-from claims'],
        sourceRefs: [R1223('art20-1')],
        sourceGap: contra ? undefined : KNOWN_SOURCE_GAPS.freeFrom,
        explanation: contra
          ? `The claim says the product is free from ${contra.label}, but the INCI list contains a matching ingredient.`
          : 'No contradicting ingredient was found in the INCI list. Whether this free-from wording is acceptable cannot be verified from the sources loaded.',
        suggestedAction: contra ? 'Remove the claim or reformulate.' : 'Expert review required before use.',
      });
    }

    // R08 medical
    const md = match(F.medical, seg);
    if (md.any) {
      add(seg, {
        ruleId: 'R08',
        status: 'blocked',
        category: 'Medicinal claim',
        title: 'Medicinal wording detected',
        trigger: md.any,
        triggerDe: md.de,
        evidenceUsed: [],
        missing: [],
        sourceRefs: [R1223('art2-1a'), R1223('art20-1')],
        explanation: `“${md.any}” suggests treating or preventing a condition. The cosmetic product definition covers cleaning, perfuming, changing appearance, protecting, keeping in good condition or correcting body odours. Wording beyond that may change how the product is classified.`,
        suggestedAction: 'Remove the medicinal wording; consult a regulatory expert.',
      });
    }

    // R09 authority
    const au = match(F.authority, seg);
    if (au.any) {
      add(seg, {
        ruleId: 'R09',
        status: 'blocked',
        category: 'Authority approval claim',
        title: 'Approval or endorsement claim',
        trigger: au.any,
        triggerDe: au.de,
        evidenceUsed: [],
        missing: ['Documented basis for the endorsement'],
        sourceRefs: [R655('c1-1'), R655('c3-1')],
        explanation: 'The wording implies approval or endorsement. Claims of approval by a competent authority are not allowed, and other endorsements need verifiable support.',
        suggestedAction: 'Remove the endorsement wording.',
      });
    }

    // R10 sensitive skin
    const se = match(F.sensitive, seg);
    if (se.any) {
      const tol = ofKind(product, 'tolerance-test');
      add(seg, {
        ruleId: 'R10',
        status: tol.length ? 'supported' : 'review',
        category: 'Suitability claim',
        title: tol.length ? 'Suitability claim has a tolerance test' : 'Suitability claim without tolerance data',
        trigger: se.any,
        triggerDe: se.de,
        evidenceUsed: tol.map((e) => e.id),
        missing: tol.length ? [] : ['A skin tolerance study on the target skin type'],
        sourceRefs: [R655('c3-1')],
        sourceGap: tol.length ? undefined : KNOWN_SOURCE_GAPS.sensitive,
        explanation: tol.length
          ? `“${tol[0].title}” was provided for this suitability claim.`
          : 'The text says the product suits a specific skin type, but no tolerance test was provided. Unable to verify.',
        suggestedAction: tol.length ? 'No action needed.' : 'Attach a tolerance study, or remove the skin-type claim.',
      });
    }

    // R11 natural
    const na = match(F.natural, seg);
    if (na.any) {
      add(seg, {
        ruleId: 'R11',
        status: 'review',
        category: 'Natural / origin claim',
        title: 'Unable to verify “natural” wording',
        trigger: na.any,
        triggerDe: na.de,
        evidenceUsed: [],
        missing: ['Natural-origin calculation for the formula'],
        sourceRefs: [R655('c3-1')],
        sourceGap: KNOWN_SOURCE_GAPS.natural,
        explanation: 'No evidence supports the natural-origin wording, and no curated source defines it. Unable to verify.',
        suggestedAction: 'Remove the wording or provide a natural-origin calculation for expert review.',
      });
    }

    // R12 unique
    const un = match(F.unique, seg);
    if (un.any) {
      add(seg, {
        ruleId: 'R12',
        status: 'review',
        category: 'Efficacy claim substantiation',
        title: 'Uniqueness claim',
        trigger: un.any,
        triggerDe: un.de,
        evidenceUsed: [],
        missing: ['Market comparison showing the characteristic is unique'],
        sourceRefs: [R655('c4-2')],
        explanation: 'The wording presents a characteristic as unique. That cannot be checked from the evidence provided.',
        suggestedAction: 'Remove the uniqueness wording or provide a market comparison.',
      });
    }

    // R13 volumes
    const vols = [...volumes(seg.en), ...(seg.untranslated ? [] : volumes(seg.de))];
    if (vols.length && productVolume) {
      const bad = vols.find((v) => v !== productVolume);
      add(seg, {
        ruleId: 'R13',
        status: bad ? 'blocked' : 'supported',
        category: 'Product facts',
        title: bad ? `Volume ${bad} does not match ${product.size}` : `Matches declared size (${product.size})`,
        trigger: bad ?? vols[0],
        evidenceUsed: [],
        missing: [],
        sourceRefs: seg.factKey === 'size' ? [R1223('art19-1b')] : [R1223('art20-1')],
        explanation: bad
          ? `The text states ${bad}, but the product facts declare ${product.size}.`
          : `The stated volume equals the declared product size (${product.size}).`,
        suggestedAction: bad ? `Correct the volume to ${product.size}.` : 'No action needed.',
      });
    }

    // R14 numbers EN↔DE
    if (!seg.untranslated && seg.factKey !== 'ingredients') {
      const a = extractNumbers(seg.en).join(',');
      const b = extractNumbers(seg.de).join(',');
      if (a !== b) {
        add(seg, {
          ruleId: 'R14',
          status: 'blocked',
          category: 'Translation fidelity',
          title: 'Numbers differ between English and German',
          trigger: `EN [${a || '—'}] · DE [${b || '—'}]`,
          evidenceUsed: [],
          missing: [],
          sourceRefs: [R1223('art20-1')],
          explanation: `The English text contains the numbers [${a || 'none'}] but the German text contains [${b || 'none'}]. A translation must not change quantities, durations or concentrations.`,
          suggestedAction: 'Correct the German text so every number matches the source.',
        });
      }
    }

    // R15 escalation in translation
    if (!seg.untranslated) {
      for (const fam of ESCALATION_FAMILIES) {
        const en = seg.en.match(fam.en);
        const de = seg.de.match(fam.de);
        if (de && !en) {
          add(seg, {
            ruleId: 'R15',
            status: 'blocked',
            category: 'Translation fidelity',
            title: 'German text adds a claim not in the English source',
            trigger: de[0],
            triggerDe: de[0],
            evidenceUsed: [],
            missing: [],
            sourceRefs: [R655('c4-1'), R655('c1-2')],
            explanation: `The German wording contains “${de[0]}” (${fam.key}), which has no counterpart in the English source. The translation has made the claim stronger.`,
            suggestedAction: 'Rewrite the German so it says no more than the source.',
          }, fam.key);
        }
      }
    }

    // R16 untranslated
    if (seg.untranslated) {
      add(seg, {
        ruleId: 'R16',
        status: 'review',
        category: 'Translation fidelity',
        title: 'No German text available',
        evidenceUsed: [],
        missing: ['German translation'],
        sourceRefs: [],
        explanation: 'Sample mode only contains prewritten German for the example product. This edited text has no German version yet.',
        suggestedAction: 'Write the German manually, or connect AI mode and regenerate.',
      });
    }

    // R17 brand preserved
    if (seg.id === 'ls-title' && !seg.de.includes(product.name)) {
      add(seg, {
        ruleId: 'R17',
        status: 'review',
        category: 'Translation fidelity',
        title: 'Brand name altered in German title',
        evidenceUsed: [],
        missing: [],
        sourceRefs: [],
        explanation: `The German title does not contain the exact product name “${product.name}”.`,
        suggestedAction: 'Keep the registered product name unchanged.',
      });
    }

    // R18 market-entry prerequisites
    if (seg.factKey === 'responsiblePerson') {
      const rp = ofKind(product, 'eu-responsible-person');
      add(seg, {
        ruleId: 'R18',
        status: rp.length ? 'supported' : 'review',
        category: 'Market entry prerequisite',
        title: rp.length ? 'EU Responsible Person documented' : 'No EU Responsible Person on file',
        evidenceUsed: rp.map((e) => e.id),
        missing: rp.length ? [] : ['Designation of a Responsible Person established in the EU'],
        sourceRefs: [R1223('art4-1'), R655('art2')],
        explanation: rp.length
          ? 'A Responsible Person designation was provided as evidence.'
          : 'A product may only be placed on the EU market when a Responsible Person is designated within the EU. None is documented here.',
        suggestedAction: rp.length ? 'Confirm the designation is current.' : 'Appoint an EU Responsible Person and attach the agreement.',
      });
    }
    if (seg.factKey === 'safetyReport') {
      const eu = product.evidence.filter((e) => e.kind === 'safety-report' && e.jurisdiction === 'EU');
      const uk = product.evidence.filter((e) => e.kind === 'safety-report' && e.jurisdiction === 'UK');
      add(seg, {
        ruleId: 'R18',
        status: eu.length ? 'supported' : 'review',
        category: 'Market entry prerequisite',
        title: eu.length ? 'EU safety report documented' : uk.length ? 'UK report only — expert review required' : 'No safety report on file',
        evidenceUsed: [...eu, ...uk].map((e) => e.id),
        missing: eu.length ? [] : ['Cosmetic product safety report under Regulation (EC) No 1223/2009'],
        sourceRefs: [R1223('art10-1'), R1223('art11-1')],
        explanation: eu.length
          ? 'An EU safety report was provided.'
          : uk.length
            ? 'A UK safety report is on file. Whether it can serve as the EU report requires a qualified safety assessor.'
            : 'No safety report was provided.',
        suggestedAction: eu.length ? 'No action needed.' : 'Ask an EU safety assessor to review or prepare the report.',
      });
    }
    if (seg.factKey === 'notification') {
      const n = ofKind(product, 'cpnp-notification');
      add(seg, {
        ruleId: 'R18',
        status: n.length ? 'supported' : 'review',
        category: 'Market entry prerequisite',
        title: n.length ? 'CPNP notification documented' : 'CPNP notification not documented',
        evidenceUsed: n.map((e) => e.id),
        missing: n.length ? [] : ['CPNP notification reference'],
        sourceRefs: [R1223('art13-1')],
        explanation: n.length
          ? 'A notification reference was provided.'
          : 'Before placing the product on the market, the Responsible Person must submit notification information electronically. No notification is documented.',
        suggestedAction: n.length ? 'No action needed.' : 'Submit the notification once a Responsible Person is appointed.',
      });
    }

    // R19 INCI list
    if (seg.factKey === 'ingredients') {
      const ok = seg.en.includes(inci) && seg.de.includes(inci);
      add(seg, {
        ruleId: 'R19',
        status: ok ? 'supported' : 'blocked',
        category: 'Product facts',
        title: ok ? 'INCI list matches product facts' : 'INCI list differs from product facts',
        evidenceUsed: [],
        missing: [],
        sourceRefs: [],
        explanation: ok
          ? 'The ingredient list in both languages is identical to the INCI list supplied for the product.'
          : 'The ingredient list does not match the INCI list supplied.',
        suggestedAction: ok ? 'No action needed.' : 'Restore the supplied INCI list.',
      });
    }

    // R20 German label language
    if (seg.id === 'pi-precautions' || seg.id === 'pi-content') {
      add(seg, {
        ruleId: 'R20',
        status: 'review',
        category: 'Market entry prerequisite',
        title: 'German label-language rules — expert review required',
        evidenceUsed: [],
        missing: ['Confirmation of German national label-language requirements'],
        sourceRefs: [R1223('art19-5')],
        sourceGap: KNOWN_SOURCE_GAPS.germanLaw,
        explanation: 'EU law leaves the language of this information to the Member State. The applicable German rule is not in the curated library, so this cannot be verified here.',
        suggestedAction: 'Confirm with a German regulatory specialist.',
      });
    }
  }

  return { findings, rulesRun: RULES.map((r) => r.id) };
}

export function segmentStatus(findings: Finding[], segmentId: string): EvidenceStatus | 'none' {
  const fs = findings.filter((f) => f.segmentId === segmentId);
  if (!fs.length) return 'none';
  return fs.reduce<EvidenceStatus>((w, f) => (STATUS_RANK[f.status] > STATUS_RANK[w] ? f.status : w), 'supported');
}

export function summarise(findings: Finding[], segments: Segment[]) {
  const counts = { supported: 0, review: 0, blocked: 0, none: 0 };
  for (const s of segments) counts[segmentStatus(findings, s.id)]++;
  return counts;
}

