# ProofLingo

**Go global. Know what to trust.**

ProofLingo helps a UK small business take a product into a new market. It localises the product listing, marketing copy and product information into German, then **TrustMap** checks every generated statement against the evidence the business actually holds and against curated EU regulatory sources. Each sentence is coloured **green** (backed by your evidence), **amber** (needs a person to check) or **red** (must be fixed before publishing), with the reason, the evidence and the law behind it.

IEEE Hackathon · Track 2: Scaling Globally with AI (sponsored by the 48 Group).

> Statuses describe *evidence coverage*. They are not legal advice and never certify compliance. A passing check is not legal approval.

---

## Where this fits in the team repo

This folder is **Module 4 (UI + integration)**. It runs end to end on its own today, so it doubles as the integration shell for the other modules:

| Team module | Folder | What's there now |
|---|---|---|
| 1 · Localise | `/localise` | `compose.ts`: sample-mode German content and the regulatory fact lines. Live AI generation is `POST /api/generate` in `app/server/index.ts`. |
| 2 · Regulatory | `/regulatory` | `sources.ts`: exact EUR-Lex excerpts with URLs, plus the known gaps |
| 3 · Trust | `/trust` | `rules.ts`: deterministic checks → supported / review / blocked |
| Shared data | `/data` | `types.ts` (data contract) and `sample.ts` (fictional demo data) |
| Tests | `/eval` | `rules.test.ts`, `report.test.ts` (run `npm test` from `app/`) |
| 4 · UI + integration | `/app` (this folder) | React UI in `src/`, API server in `server/` |

Each module folder has its own README. The app imports the modules directly, so a teammate can change `/trust/rules.ts` and see the result in the UI straight away.

**Data contract:** a statement here is a `Segment` (`segment_id` → `id`, `source` → `en`, `localised` → `de`), and each `reg_flags` entry corresponds to a `Finding` with `sourceRefs` holding the exact citation. See `/data/types.ts`. One deliberate difference from the draft contract: this app shows **no numeric trust score** (e.g. `0.72`). Statuses are evidence coverage with written reasons, so we don't present a made-up confidence number.

---

## Quick start

Requires Node 22+ (tested on Node 24). Run from this `app/` folder:

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173. This starts the web app (Vite, port 5173) and the API server (Express, port 8787). Without an API key the app runs in **Sample mode**, which needs no credentials.

| Command | What it does |
|---|---|
| `npm run dev` | Web app + API server with live reload |
| `npm test` | Unit tests for the validation engine, the demo flow and the report export |
| `npm run typecheck` | TypeScript checks for the browser app and the server |
| `npm run build` | Production build into `dist/` |
| `npm start` | Build, then serve app + API together on http://localhost:8787 |

> **Note on the folder name:** this project sits in a folder whose path contains `:` (`CITY:WESTMINSTER`). A colon breaks `PATH` lookups, so the npm scripts call each tool through `node node_modules/...` directly, and Vite's strict file-serving check is relaxed only when the path contains `:`. Moving the project to a path without `:` works as well.

---

## Share online (Netlify)

Live demo: **https://prooflingo-ieee.netlify.app** (sample mode; Live AI only runs locally, because the API key must stay on a server).

QR code for slides: [`docs/prooflingo-qr.png`](../docs/prooflingo-qr.png) (or the `.svg` for sharp printing).

To redeploy after changes, run from `app/` (uses the Netlify CLI login on your machine):

```bash
npm run build:share
npx netlify-cli deploy --prod --dir dist-share --site 9f713451-8d3b-4f8e-ab47-b9753354bb7e
```

## 90-second judge demo

Start from a clean state. If you have run the app before, click **Start over** on **Your product**.

| Time | Action | What to point out |
|---|---|---|
| 0:00 | **Your product** shows the start screen. | One sentence says what the tool does. The badge next to the title says **Sample mode**, so we never pretend a model is running. |
| 0:10 | Click **Use the example product**. | The product summary lists the claims and the evidence. The business has hydration, perception and formula data, plus a *UK* safety report, but **no clinical study**. |
| 0:20 | Click **Generate German content**, then **Review and fix**. | **Review** opens like a banking app: a big **"2 sentences to fix"**, then "3 need an expert · 4 launch steps to sort", and a progress bar. The rules ran instantly; no model judged its own output. |
| 0:30 | Click **Fix next**. | The detail panel shows the German sentence with the problem words highlighted, **What's wrong** ("It says clinically proven, but you have no clinical study") and **What's missing**. Open **What the law says** for the exact EUR-Lex quotes from Reg. (EU) 655/2013. |
| 0:50 | Keep "Also fix the same claim in Marketing" ticked and tap **Use this fix**. | The checks re-run automatically: **"Fixed and checked again"**, the headline flips to **"Nothing to fix"**, and "Checked again: 6 problems fixed". Fixed means the check passes; it isn't legal approval. |
| 1:05 | Scroll to **Before you can sell in Germany** and open **Appoint an EU Responsible Person**. Tap **Send to an expert**. | Business prerequisites are kept apart from wording: Responsible Person, EU safety assessment, CPNP registration and German label rules. Fixing a claim didn't make them disappear. |
| 1:20 | Switch to **Side by side** (or **Shop preview**), then open **History**. | English and German next to each other with each sentence's label. History lists every action like a bank statement and shows *What ProofLingo changed*. Click **Download report** to export. |

---

## Connecting a real LLM (Live AI mode)

The API key lives **only on the server**. The browser talks to `/api/*` and never sees the key.

1. Copy `.env.example` to `.env` (`.env` is git-ignored).
2. Set `ANTHROPIC_API_KEY=...` in `.env`. Optionally set `PROOFLINGO_MODEL`; the default is `claude-opus-5-5`.
3. Restart `npm run dev`. The server log prints `AI mode connected (...)` and the **Live AI** option becomes available on **Your product**. In **Review** you also get **Fix with AI**.

How it works (`server/index.ts`):

- `POST /api/generate` calls the Anthropic Messages API with **structured outputs**: a Zod schema enforced by the API, then parsed again with Zod on the server. The model returns German text only.
- The server, not the model, attaches the English source text for claims and builds every regulatory fact line (size, INCI, Responsible Person, safety report, CPNP) from product data.
- Refusals, truncation and schema mismatches return clear errors. The UI shows them, and nothing falls back silently.
- Server-side refusal fallbacks are enabled (`fallbacks: "default"`).
- `POST /api/revise` drafts a revision for a flagged statement. It is offered in AI mode alongside manual editing.
- **The model cannot set or override a status.** Every output goes through the same deterministic rule engine. Blockers can only be cleared by changing the text and re-running the checks.

---

## What is implemented, simulated, or future work

**Implemented (real logic running on app state)**
- Product form, three localised documents, side-by-side comparison and German customer preview.
- Deterministic TrustMap engine (`/trust/rules.ts`) with 20 rules. They cover clinical and absolute claims, time-bound results, hydration duration vs measured timepoints, sensory claims vs perception data, ingredient presence and concentration vs INCI and spec, free-from contradictions, medicinal wording, endorsements, suitability, "natural", uniqueness, volume vs declared size, numbers preserved EN↔DE, German text adding claims, untranslated text, brand preservation, and EU market-entry prerequisites.
- A review screen built like a banking app: summary card ("2 sentences to fix") with a progress bar, a to-do list grouped by urgency, and a detail panel (a bottom sheet on phones) that goes what's wrong → what's missing → suggested fix. Actions: use this fix, edit myself, send to an expert, remove. Every change is re-checked automatically, and the screen shows what it fixed.
- A curated source library with **verbatim excerpts checked against EUR-Lex** (Official Journal versions of Reg. (EU) 655/2013 and Reg. (EC) 1223/2009). Topics without a curated source report **Can't verify** and go to a specialist.
- Activity feed with before/after text for each fix, Markdown and JSON report download, and a "What ProofLingo changed" comparison computed from the session.
- Server-side structured LLM generation and revision drafts (needs a key).
- Local persistence of non-sensitive demo state (`localStorage`).

**Simulated / sample data**
- The company and product are fictional. In sample mode, German text comes from a prewritten library (`/data/sample.ts`), and the curated revisions are prewritten. This is labelled throughout the UI. Text without a prewritten translation is flagged as untranslated, not invented.
- The evidence items are fictional descriptions; no documents are parsed.

**Future work**
- Upload and parse real evidence documents (PDF studies, CPSR) and link findings to page references.
- Retrieval over a larger, versioned regulatory corpus, including consolidated texts, Commission guidance on claims, and German national law.
- More markets and languages. Native-speaker and regulatory-expert review workflow with sign-off.
- Rule coverage evaluation on a labelled set of real claims.

---

## Architecture

```
IceBeak_AI/
  app/                 Module 4 · UI + integration (this folder)
    src/state/         Reducer: generate → validate → revise → revalidate; history; localStorage
    src/lib/           API client, report export
    src/components/    Sidebar, header and progress, UI primitives
    src/views/         LaunchStudio (Your product), TrustMap (Review, incl. side by side + shop preview), Sources, History
    server/index.ts    Express API: status, structured generation, fix drafts (holds the API key)
  localise/compose.ts  Sample-mode generation + deterministic regulatory fact lines
  regulatory/sources.ts  Curated regulatory excerpts (verbatim, with URLs). No generated text.
  trust/rules.ts       TrustMap rule engine (deterministic, no model)
  data/types.ts        Shared data contract: Product, Segment, Finding, ValidationRun…
  data/sample.ts       SAMPLE MODE data: fictional product, prewritten German, curated fixes
  eval/                node:test suites (run npm test from app/)
```

**Application states**

```
start screen ──use example / enter own──▶ product ready ──generate──▶ content v1 + check (automatic)
                                     ▲                                    │
                     edit product ───┘ (content marked out of date)       ▼
                                          summary + to-do list → pick item ("Fix next") → detail panel
                                                                          │ use fix / edit / remove
                                                                          ▼
                                       content v2 + check again (automatic) → "Fixed and checked again"
                                                                          │ next item / send to an expert
```

Review splits findings in two: **wording** (sentences the business can rewrite) and **launch steps** (Responsible Person, safety assessment, CPNP, German label rules). The split comes from the rule categories in `/trust/rules.ts` (`splitCounts`, `launchSteps`), not from the UI.
