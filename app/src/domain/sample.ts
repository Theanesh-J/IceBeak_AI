// SAMPLE SCENARIO DATA — fictional company and product, prewritten German text.
// Nothing in this file is produced by a model. It powers "Sample scenario" mode.

import type { ProductInput, Segment } from './types';

export const SAMPLE_COMPANY = {
  name: 'Northfield Skincare',
  homeMarket: 'United Kingdom',
  destination: 'Germany',
};

export const SAMPLE_PRODUCT: ProductInput = {
  name: 'Northfield Oat & Ceramide Daily Moisturiser',
  category: 'Face moisturiser',
  description: 'A lightweight daily cream for dry and sensitive skin.',
  size: '50 ml',
  ingredients:
    'Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Squalane, Niacinamide, Avena Sativa Kernel Flour, Ceramide NP, Sodium Hyaluronate, Panthenol, Glyceryl Stearate, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin, Tocopherol, Citric Acid',
  claims: [
    'Clinically proven to eliminate wrinkles in seven days',
    'Up to 24-hour hydration',
    'With 4% niacinamide and ceramide NP',
    'Fragrance-free formula',
    'Leaves skin feeling softer and more comfortable',
  ],
  evidence: [
    {
      id: 'ev-hydration',
      kind: 'instrumental-test',
      title: 'Corneometer hydration study',
      details: '24 volunteers. Skin hydration measured at baseline, 8 hours and 24 hours after a single application.',
      jurisdiction: 'n/a',
    },
    {
      id: 'ev-perception',
      kind: 'consumer-perception',
      title: 'In-use consumer perception test',
      details: '52 participants, 4 weeks of twice-daily use. Self-assessment questionnaire on softness and comfort.',
      jurisdiction: 'n/a',
    },
    {
      id: 'ev-formula',
      kind: 'ingredient-spec',
      title: 'Formula specification v3.2',
      details: 'Full INCI list with concentrations: Niacinamide 4%, Ceramide NP 0.2%, Sodium Hyaluronate 0.1%. No added fragrance.',
      jurisdiction: 'n/a',
    },
    {
      id: 'ev-cpsr-uk',
      kind: 'safety-report',
      title: 'UK Cosmetic Product Safety Report',
      details: 'Prepared for the Great Britain market by a UK safety assessor.',
      jurisdiction: 'UK',
    },
  ],
  targetCountry: 'DE',
};

export const CATEGORY_DE: Record<string, string> = {
  'face moisturiser': 'Feuchtigkeitscreme für das Gesicht',
  'face cream': 'Gesichtscreme',
  'body lotion': 'Körperlotion',
  serum: 'Serum',
};

/** Prewritten EN→DE sentence library used by sample mode. Keys are normalised English. */
export const SAMPLE_TRANSLATIONS: Record<string, string> = {
  'a lightweight daily cream for dry and sensitive skin.': 'Eine leichte Tagescreme für trockene und empfindliche Haut.',
  'clinically proven to eliminate wrinkles in seven days': 'Klinisch erwiesen: beseitigt Falten in sieben Tagen',
  'up to 24-hour hydration': 'Bis zu 24 Stunden Feuchtigkeit',
  'with 4% niacinamide and ceramide np': 'Mit 4 % Niacinamid und Ceramid NP',
  'fragrance-free formula': 'Parfümfreie Formel',
  'leaves skin feeling softer and more comfortable': 'Für ein spürbar weicheres und angenehmeres Hautgefühl',
  'suitable for sensitive skin': 'Geeignet für empfindliche Haut',
};

export function normalise(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Prewritten marketing copy. Segments tied to a claim only appear if that claim is in the input. */
export const SAMPLE_MARKETING: Array<Omit<Segment, 'origin'>> = [
  {
    id: 'mk-headline',
    docType: 'marketing',
    field: 'Headline',
    en: 'Your daily ritual for comfortable skin.',
    de: 'Ihr tägliches Ritual für ein angenehmes Hautgefühl.',
    claimRef: normalise('Leaves skin feeling softer and more comfortable'),
  },
  {
    id: 'mk-body-1',
    docType: 'marketing',
    field: 'Body copy',
    en: 'Made in Yorkshire, our lightweight cream leaves skin feeling softer and more comfortable.',
    de: 'Unsere leichte Creme aus Yorkshire hinterlässt ein spürbar weicheres und angenehmeres Hautgefühl.',
    claimRef: normalise('Leaves skin feeling softer and more comfortable'),
  },
  {
    id: 'mk-body-2',
    docType: 'marketing',
    field: 'Feature line',
    en: 'Clinically proven to eliminate wrinkles in seven days – see the difference in a week.',
    de: 'Klinisch erwiesen: Falten verschwinden in sieben Tagen – sehen Sie den Unterschied nach einer Woche.',
    claimRef: normalise('Clinically proven to eliminate wrinkles in seven days'),
  },
  {
    id: 'mk-social',
    docType: 'marketing',
    field: 'Social caption',
    en: 'Gentle, naturally derived care for everyday use.',
    de: 'Sanfte Pflege mit Inhaltsstoffen natürlichen Ursprungs für jeden Tag.',
  },
  {
    id: 'mk-cta',
    docType: 'marketing',
    field: 'Call to action',
    en: 'Discover the Daily Moisturiser.',
    de: 'Entdecken Sie die Daily Moisturiser.',
  },
];

export const SAMPLE_INFO: Array<Omit<Segment, 'origin'>> = [
  {
    id: 'pi-use',
    docType: 'info',
    field: 'Directions for use',
    en: 'Apply morning and evening to clean face and neck.',
    de: 'Morgens und abends auf das gereinigte Gesicht und den Hals auftragen.',
  },
  {
    id: 'pi-precautions',
    docType: 'info',
    field: 'Precautions',
    en: 'For external use only. Avoid contact with eyes.',
    de: 'Nur zur äußerlichen Anwendung. Kontakt mit den Augen vermeiden.',
  },
];

/**
 * Curated revisions for sample mode, keyed by the segment's claimRef or id.
 * Each revision only uses wording covered by evidence in SAMPLE_PRODUCT.
 */
export const SAMPLE_REVISIONS: Record<string, { en: string; de: string; rationale: string }> = {
  'claim:clinically proven to eliminate wrinkles in seven days': {
    en: 'Comfortable, softer-feeling skin with daily use',
    de: 'Angenehm weiches Hautgefühl bei täglicher Anwendung',
    rationale:
      'Removes the clinical, wrinkle-elimination and seven-day promises. Replaces them with a sensory benefit that the provided consumer perception test covers.',
  },
  'mk-body-2': {
    en: 'Leaves skin feeling softer and more comfortable – a lightweight cream made for every day.',
    de: 'Hinterlässt ein spürbar weicheres, angenehmeres Hautgefühl – eine leichte Creme für jeden Tag.',
    rationale:
      'Removes the unsubstantiated clinical and time-bound wrinkle claim. Keeps a sensory benefit covered by the consumer perception test.',
  },
  'mk-social': {
    en: 'Gentle care for everyday use.',
    de: 'Sanfte Pflege für jeden Tag.',
    rationale: 'Drops “naturally derived”, which no evidence or curated source in this workspace covers.',
  },
};
