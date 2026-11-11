# Eval

Automated tests for the trust checks and the report export. Run them from `/app`:

```bash
cd app
npm test
```

| File | What it covers |
|---|---|
| `rules.test.ts` | The full demo flow: the clinical claim is blocked, the fix resolves it, and unrelated checks stay open. Also covers number drift in translation, claims added by the German, free-from contradictions, missing ingredients, size mismatches, medicinal wording, inflected German words and source gaps. |
| `report.test.ts` | The Markdown review report includes statuses, references and the disclaimer. |
