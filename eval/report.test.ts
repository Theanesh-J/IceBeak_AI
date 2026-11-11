import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleContent } from '../localise/compose.ts';
import { SAMPLE_PRODUCT } from '../data/sample.ts';
import { validate } from '../trust/rules.ts';
import { buildMarkdownReport } from '../app/src/lib/report.ts';
import { initialState, type AppState } from '../app/src/state/store.tsx';

test('markdown report includes statuses, references and the disclaimer', () => {
  const content = generateSampleContent(SAMPLE_PRODUCT);
  const { findings, rulesRun } = validate(SAMPLE_PRODUCT, content);
  const state: AppState = {
    ...initialState,
    product: SAMPLE_PRODUCT,
    content,
    contentVersion: 1,
    validation: { id: 'v', ranAt: '2026-11-11T10:00:00Z', contentVersion: 1, findings, rulesRun, segmentCount: content.segments.length, snapshot: {} },
  };
  const md = buildMarkdownReport(state);
  assert.match(md, /Blocked/);
  assert.match(md, /Regulation \(EU\) No 655\/2013/);
  assert.match(md, /not a legal opinion/);
  assert.match(md, /Sample scenario/);
});
