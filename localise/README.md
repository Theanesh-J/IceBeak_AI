# Module 1 · Localise

Turns the English product input into German content.

| File | What it does |
|---|---|
| `compose.ts` | **Sample mode** generation: builds the German listing, marketing and product information from prewritten translations in `/data/sample.ts` (no model). It also builds the regulatory fact lines (size, INCI, Responsible Person, safety report, CPNP) from product facts. A model never writes these, in either mode. |

**Live AI** generation (a structured Claude call with a validated schema) is the `POST /api/generate` endpoint in `/app/server/index.ts`. To plug in another translation pipeline, return segments in the shape of `Segment` in `/data/types.ts`.
