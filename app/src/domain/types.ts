// Core domain types shared by the browser app and the Node server.

export type MarketCode = 'DE';

export type EvidenceKind =
  | 'clinical-study'
  | 'instrumental-test'
  | 'consumer-perception'
  | 'tolerance-test'
  | 'ingredient-spec'
  | 'safety-report'
  | 'eu-responsible-person'
  | 'cpnp-notification'
  | 'other';

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  title: string;
  /** Free-text scope of the evidence: method, sample, durations, concentrations. */
  details: string;
  jurisdiction: 'UK' | 'EU' | 'n/a';
}

export interface ProductInput {
  name: string;
  category: string;
  description: string;
  size: string;
  /** INCI list, comma separated. */
  ingredients: string;
  /** One claim per entry. */
  claims: string[];
  evidence: EvidenceItem[];
  targetCountry: MarketCode;
}

export type DocType = 'listing' | 'marketing' | 'info';

/** Regulatory fact lines are composed by the app, never by the model. */
export type FactKey = 'size' | 'ingredients' | 'responsiblePerson' | 'safetyReport' | 'notification';

export interface Segment {
  id: string;
  docType: DocType;
  /** Human label: "Title", "Bullet 2", "Headline"… */
  field: string;
  en: string;
  de: string;
  /** Normalised source claim this segment was derived from, if any. */
  claimRef?: string;
  factKey?: FactKey;
  origin: 'sample' | 'model' | 'deterministic' | 'revision' | 'manual';
  /** Set when sample mode has no translation for the English text. */
  untranslated?: boolean;
}

export type GenerationMode = 'sample' | 'ai';

export interface LocalisedContent {
  mode: GenerationMode;
  model?: string;
  generatedAt: string;
  segments: Segment[];
}

export type EvidenceStatus = 'supported' | 'review' | 'blocked';

export type IssueCategory =
  | 'Efficacy claim substantiation'
  | 'Absolute or exaggerated performance'
  | 'Time-bound performance claim'
  | 'Ingredient claim'
  | 'Free-from claim'
  | 'Medicinal claim'
  | 'Authority approval claim'
  | 'Suitability claim'
  | 'Natural / origin claim'
  | 'Sensory / perception claim'
  | 'Hydration claim'
  | 'Product facts'
  | 'Translation fidelity'
  | 'Market entry prerequisite';

export interface Finding {
  id: string; // stable: ruleId + segmentId
  ruleId: string;
  segmentId: string;
  status: EvidenceStatus;
  category: IssueCategory;
  title: string;
  /** Matched text that triggered the rule. */
  trigger?: string;
  /** Matched German text, when detected in the German output. */
  triggerDe?: string;
  evidenceUsed: string[]; // EvidenceItem ids
  missing: string[]; // human descriptions of missing evidence
  sourceRefs: SourceRef[];
  /** "Unable to verify" when no curated source covers the topic. */
  sourceGap?: string;
  explanation: string;
  suggestedAction: string;
}

export interface SourceRef {
  sourceId: string;
  provisionId: string;
}

export interface ValidationRun {
  id: string;
  ranAt: string;
  contentVersion: number;
  findings: Finding[];
  rulesRun: string[];
  segmentCount: number;
  /** Text of each segment as checked, to detect edits made since. */
  snapshot: Record<string, string>;
}

export type ReviewerDecision =
  | 'revision-applied'
  | 'edited-manually'
  | 'escalated'
  | 'acknowledged';

export interface HistoryEntry {
  id: string;
  at: string;
  type: 'generated' | 'revision' | 'manual-edit' | 'validation' | 'decision' | 'product-loaded';
  summary: string;
  segmentId?: string;
  before?: { en: string; de: string };
  after?: { en: string; de: string };
  findingIds?: string[];
  decision?: ReviewerDecision;
  resolved?: string[];
  stillOpen?: number;
}
