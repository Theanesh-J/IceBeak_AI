# Module 3 · Trust

Decides how far each sentence can be trusted, and says why.

| File | What it does |
|---|---|
| `rules.ts` | TrustMap rule engine: 20 deterministic checks that mark each sentence **supported** (green), **review** (amber) or **blocked** (red), with the evidence, missing information and legal reference behind each finding. No model is involved, so a model can't talk its way past a blocker. |

Used by the app (`/app`) and tested in `/eval/rules.test.ts`.

Other trust work (for example a Python scoring model) can live alongside in this folder. To plug it into the app, return findings in the shape of `Finding` in `/data/types.ts`.
