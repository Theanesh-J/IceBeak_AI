# Data

Shared contract and demo inputs.

| File | What it is |
|---|---|
| `types.ts` | The shared data contract used by every module: `ProductInput`, `Segment` (one sentence: `id`, `en`, `de`), `Finding` (one check result, with `sourceRefs`), `ValidationRun`. |
| `sample.ts` | **Sample data, fictional:** Northfield Skincare's moisturiser, its claims and evidence, prewritten German text, and prewritten fixes. Clearly separate from real AI output. |

Mapping to the draft JSON contract in the team README: `segment_id` → `Segment.id`, `source` → `en`, `localised` → `de`, each `reg_flags` item → a `Finding`.
