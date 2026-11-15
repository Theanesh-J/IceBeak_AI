import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type {
  Finding,
  GenerationMode,
  HistoryEntry,
  LocalisedContent,
  ProductInput,
  ReviewerDecision,
  ValidationRun,
} from '../../../data/types';
import { SAMPLE_PRODUCT } from '../../../data/sample';
import { splitCounts, summarise, validate } from '../../../trust/rules';

export interface Decision {
  decision: ReviewerDecision;
  note?: string;
  at: string;
}

export interface AppState {
  product: ProductInput;
  mode: GenerationMode;
  content?: LocalisedContent;
  contentVersion: number;
  productChangedSinceGeneration: boolean;
  validation?: ValidationRun;
  lastDiff?: { resolved: Finding[]; added: Finding[]; stillOpen: number };
  /** Counts from the first check of the current generation: the unchecked baseline. */
  baseline?: { supported: number; review: number; blocked: number; none: number; statements: number; openFindings: number };
  decisions: Record<string, Decision>;
  history: HistoryEntry[];
  selectedSegmentId?: string;
}

const EMPTY_PRODUCT: ProductInput = {
  name: '',
  category: '',
  description: '',
  size: '',
  ingredients: '',
  claims: [''],
  evidence: [],
  targetCountry: 'DE',
};

export const initialState: AppState = {
  product: EMPTY_PRODUCT,
  mode: 'sample',
  contentVersion: 0,
  productChangedSinceGeneration: false,
  decisions: {},
  history: [],
};

export type Action =
  | { type: 'loadExample' }
  | { type: 'reset' }
  | { type: 'setProduct'; product: ProductInput }
  | { type: 'setMode'; mode: GenerationMode }
  | { type: 'setContent'; content: LocalisedContent }
  | { type: 'runValidation' }
  | { type: 'select'; segmentId?: string }
  | {
      type: 'reviseSegments';
      edits: Array<{ segmentId: string; en: string; de: string }>;
      decision: Extract<ReviewerDecision, 'revision-applied' | 'edited-manually'>;
      findingIds: string[];
      note?: string;
    }
  | { type: 'removeSegment'; segmentId: string; findingIds: string[] }
  | { type: 'decide'; findingIds: string[]; decision: ReviewerDecision; segmentId: string; note?: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const isOpen = (f: Finding) => f.status !== 'supported';

function runValidation(state: AppState): AppState {
  if (!state.content) return state;
  const { findings, rulesRun } = validate(state.product, state.content);
  const run: ValidationRun = {
    id: uid(),
    ranAt: now(),
    contentVersion: state.contentVersion,
    findings,
    rulesRun,
    segmentCount: state.content.segments.length,
    snapshot: Object.fromEntries(state.content.segments.map((s) => [s.id, `${s.en}\n${s.de}`])),
  };
  const prevOpen = state.validation?.findings.filter(isOpen) ?? [];
  const nextOpen = findings.filter(isOpen);
  const nextOpenIds = new Set(nextOpen.map((f) => f.id));
  const prevOpenIds = new Set(prevOpen.map((f) => f.id));
  const resolved = prevOpen.filter((f) => !nextOpenIds.has(f.id));
  const added = state.validation ? nextOpen.filter((f) => !prevOpenIds.has(f.id)) : [];
  const c = splitCounts(findings, state.content.segments);
  const entry: HistoryEntry = {
    id: uid(),
    at: run.ranAt,
    type: 'validation',
    summary: `${state.validation ? 'Checked again' : `Checked ${run.segmentCount} sentences`} · ${c.blocked} to fix, ${c.review} for an expert, ${c.launchOpen} launch steps open`,
    resolved: resolved.map((f) => f.id),
    stillOpen: nextOpen.length,
  };
  return {
    ...state,
    validation: run,
    lastDiff: state.validation ? { resolved, added, stillOpen: nextOpen.length } : undefined,
    history: [entry, ...state.history],
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loadExample':
      return {
        ...initialState,
        mode: state.mode,
        product: structuredClone(SAMPLE_PRODUCT),
        history: [{ id: uid(), at: now(), type: 'product-loaded', summary: 'Example product loaded · Northfield Oat & Ceramide Daily Moisturiser' }],
      };
    case 'reset':
      return { ...initialState, mode: state.mode };
    case 'setProduct':
      return { ...state, product: action.product, productChangedSinceGeneration: !!state.content };
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'setContent': {
      const next: AppState = {
        ...state,
        content: action.content,
        contentVersion: state.contentVersion + 1,
        productChangedSinceGeneration: false,
        validation: undefined,
        lastDiff: undefined,
        baseline: undefined,
        decisions: {},
        selectedSegmentId: undefined,
        history: [
          {
            id: uid(),
            at: now(),
            type: 'generated',
            summary:
              action.content.mode === 'ai'
                ? `German content created · ${action.content.segments.length} sentences written by ${action.content.model}`
                : action.content.mode === 'local'
                  ? `German content created · ${action.content.segments.length} sentences translated by ${action.content.model}`
                  : `German content created · ${action.content.segments.length} sentences from prewritten sample text, no model`,
          },
          ...state.history,
        ],
      };
      // TrustMap inspects every generation immediately.
      const checked = runValidation(next);
      const f = checked.validation!.findings;
      return {
        ...checked,
        baseline: {
          ...summarise(f, action.content.segments),
          statements: action.content.segments.length,
          openFindings: f.filter(isOpen).length,
        },
      };
    }
    case 'runValidation':
      return runValidation(state);
    case 'select':
      return { ...state, selectedSegmentId: action.segmentId };
    case 'reviseSegments': {
      if (!state.content) return state;
      const segments = state.content.segments.map((s) => {
        const e = action.edits.find((x) => x.segmentId === s.id);
        return e
          ? { ...s, en: e.en, de: e.de, untranslated: false, origin: action.decision === 'revision-applied' ? ('revision' as const) : ('manual' as const) }
          : s;
      });
      const entries: HistoryEntry[] = action.edits.map((e) => {
        const before = state.content!.segments.find((s) => s.id === e.segmentId)!;
        return {
          id: uid(),
          at: now(),
          type: action.decision === 'revision-applied' ? 'revision' : 'manual-edit',
          summary: `${action.decision === 'revision-applied' ? 'Fix applied' : 'Edited by you'} · ${before.field}`,
          segmentId: e.segmentId,
          before: { en: before.en, de: before.de },
          after: { en: e.en, de: e.de },
          findingIds: action.findingIds.filter((id) => id.includes(`:${e.segmentId}`)),
          decision: action.decision,
        };
      });
      const decisions = { ...state.decisions };
      for (const id of action.findingIds) decisions[id] = { decision: action.decision, note: action.note, at: now() };
      // Every change is checked again straight away by the same deterministic rules.
      return runValidation({
        ...state,
        content: { ...state.content, segments },
        contentVersion: state.contentVersion + 1,
        decisions,
        history: [...entries.reverse(), ...state.history],
      });
    }
    case 'removeSegment': {
      if (!state.content) return state;
      const seg = state.content.segments.find((s) => s.id === action.segmentId);
      if (!seg) return state;
      const decisions = { ...state.decisions };
      for (const id of action.findingIds) decisions[id] = { decision: 'revision-applied', note: 'Statement removed', at: now() };
      return runValidation({
        ...state,
        content: { ...state.content, segments: state.content.segments.filter((s) => s.id !== action.segmentId) },
        contentVersion: state.contentVersion + 1,
        selectedSegmentId: undefined,
        decisions,
        history: [
          {
            id: uid(),
            at: now(),
            type: 'revision',
            summary: `Sentence removed · ${seg.field}`,
            segmentId: seg.id,
            before: { en: seg.en, de: seg.de },
            after: { en: '', de: '' },
            findingIds: action.findingIds,
            decision: 'revision-applied',
          },
          ...state.history,
        ],
      });
    }
    case 'decide': {
      const decisions = { ...state.decisions };
      for (const id of action.findingIds) decisions[id] = { decision: action.decision, note: action.note, at: now() };
      const seg = state.content?.segments.find((s) => s.id === action.segmentId);
      return {
        ...state,
        decisions,
        history: [
          {
            id: uid(),
            at: now(),
            type: 'decision',
            summary: `${action.decision === 'escalated' ? 'Sent to an expert' : 'Kept for review'} · ${seg?.field ?? action.segmentId}`,
            segmentId: action.segmentId,
            findingIds: action.findingIds,
            decision: action.decision,
          },
          ...state.history,
        ],
      };
    }
  }
}

const STORAGE_KEY = 'prooflingo.demo.v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return initialState;
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}

export function isStale(state: AppState) {
  return !!state.content && !!state.validation && state.validation.contentVersion !== state.contentVersion;
}
