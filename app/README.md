# ProofLingo

**Go global. Know what to trust.**

ProofLingo helps a UK small business take a product into a new market. It localises the product listing, marketing copy and product information into German, then **TrustMap** checks every generated statement against the evidence the business actually holds and against curated EU regulatory sources. Each statement is marked as **supported**, **missing evidence / needs review**, or **blocked**, with the reason, the evidence, and the source behind it.

IEEE Hackathon · Track 2: Scaling Globally with AI (sponsored by the 48 Group).

> Statuses describe *evidence coverage*. They are not legal advice and never certify compliance. A passing check is not legal approval.

---

## Where this fits in the team repo

This folder is **Module 4 (UI + integration)**. It runs end to end on its own today, so it doubles as the integration shell for the other modules:

| Team module | Folder | Where it plugs into this app |
|---|---|---|
| 1 · Localise | `/localise` | `server/index.ts` → `POST /api/generate` (currently one structured Claude call; swap in module output here) |
| 2 · Regulatory RAG | `/regulatory`, `/data` | `src/domain/sources.ts` (curated verbatim excerpts + URLs) and the source refs in `src/domain/rules.ts` |
| 3 · Trust | `/trust`, `/eval` | `src/domain/rules.ts` (deterministic checks → supported / review / blocked) |
| 4 · UI + integration | `/app` (this folder) | everything under `src/views` and `src/components` |

**Data contract:** a statement here is a `Segment` (`segment_id` → `id`, `source` → `en`, `localised` → `de`), and each `reg_flags` entry corresponds to a `Finding` with `sourceRefs` holding the exact citation. See `src/domain/types.ts`. One deliberate difference from the draft contract: this app shows **no numeric trust score** (e.g. `0.72`). Statuses are evidence coverage with written reasons, so we don't present a made-up confidence number.

---

## Quick start

Requires Node 22+ (tested on Node 24). Run from this `app/` folder:

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173. This starts the web app (Vite, port 5173) and the API server (Express, port 8787). Without an API key the app runs in **Sample scenario** mode, which needs no credentials.

| Command | What it does |
|---|---|
| `npm run dev` | Web app + API server with live reload |
| `npm test` | Unit tests for the validation engine, the demo flow and the report export |
| `npm run typecheck` | TypeScript checks for the browser app and the server |
| `npm run build` | Production build into `dist/` |
| `npm start` | Build, then serve app + API together on http://localhost:8787 |

> **Note on the folder name:** this project sits in a folder whose path contains `:` (`CITY:WESTMINSTER`). A colon breaks `PATH` lookups, so the npm scripts call each tool through `node node_modules/...` directly, and Vite's strict file-serving check is relaxed only when the path contains `:`. Moving the project to a path without `:` works as well.

---

## 90-second judge demo

Start from a clean state. If you have run the app before, click **Start over** in Launch Studio.

| Time | Action | What to point out |
|---|---|---|
| 0:00 | **Launch Studio** shows the start screen. | One sentence says what the tool does. The badge next to the title says **Sample mode**, so we never pretend a model is running. |
| 0:10 | Click **Use the example product**. | The product summary lists the claims and the evidence. The business has hydration, perception and formula data, plus a *UK* safety report, but **no clinical study**. |
| 0:20 | Click **Generate German content**. | The result card says **"2 statements must be fixed before you publish."** The rules ran immediately; no model judged its own output. |
| 0:30 | Click **Review and fix**. | The TrustMap verdict repeats the headline. Every sentence is coloured red, amber or green. Toggle *German / English*. |
| 0:40 | Click **Fix the first one**. | The inspector shows the German sentence with the problem words highlighted, **why it's flagged** (no clinical study), and **what's missing**. Open **Evidence and law** to show the exact EUR-Lex quotes from Reg. (EU) 655/2013. |
| 0:55 | Under **Suggested fix**, keep "Also fix the same claim in Marketing" ticked and click **Approve fix**. | The verdict changes to **"You changed the text."** Results are marked out of date, not silently updated. |
| 1:05 | Click **Re-run checks**. | **"Nothing is blocked." "Last change fixed 6 problems."** The new sentence is green, backed by the consumer perception test. Fixed is not legal approval. |
| 1:15 | Click the **Product information** tab. | The EU Responsible Person, EU safety report and CPNP notification are **still amber**, and German label rules say **Can't verify**. Fixing the claim didn't make unrelated gaps disappear. |
| 1:25 | **Review History**. | Before/after text for each fix, and the *unchecked vs TrustMap* table. Use **Markdown report** to export. |

---

## Connecting a real LLM (connected AI mode)

The API key lives **only on the server**. The browser talks to `/api/*` and never sees the key.

1. Copy `.env.example` to `.env` (`.env` is git-ignored).
2. Set `ANTHROPIC_API_KEY=...` in `.env`. Optionally set `PROOFLINGO_MODEL`; the default is `claude-opus-5-5`.
3. Restart `npm run dev`. The server log prints `AI mode connected (...)` and the **Connected AI** option becomes available in Launch Studio.

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
- Deterministic TrustMap engine (`src/domain/rules.ts`) with 20 rules. They cover clinical and absolute claims, time-bound results, hydration duration vs measured timepoints, sensory claims vs perception data, ingredient presence and concentration vs INCI and spec, free-from contradictions, medicinal wording, endorsements, suitability, "natural", uniqueness, volume vs declared size, numbers preserved EN↔DE, German text adding claims, untranslated text, brand preservation, and EU market-entry prerequisites.
- Evidence inspector, reviewer decisions (approve revision, edit manually, escalate, remove), stale-state detection, re-validation with a resolved/new diff.
- A curated source library with **verbatim excerpts checked against EUR-Lex** (Official Journal versions of Reg. (EU) 655/2013 and Reg. (EC) 1223/2009). Topics without a curated source report **Unable to verify / expert review required**.
- Change history, Markdown and JSON report export, and an unchecked-vs-verified comparison computed from the session.
- Server-side structured LLM generation and revision drafts (needs a key).
- Local persistence of non-sensitive demo state (`localStorage`).

**Simulated / sample data**
- The company and product are fictional. In sample mode, German text comes from a prewritten library (`src/domain/sample.ts`), and the curated revisions are prewritten. This is labelled throughout the UI. Text without a prewritten translation is flagged as untranslated, not invented.
- The evidence items are fictional descriptions; no documents are parsed.

**Future work**
- Upload and parse real evidence documents (PDF studies, CPSR) and link findings to page references.
- Retrieval over a larger, versioned regulatory corpus, including consolidated texts, Commission guidance on claims, and German national law.
- More markets and languages. Native-speaker and regulatory-expert review workflow with sign-off.
- Rule coverage evaluation on a labelled set of real claims.

---

## Architecture

```
src/
  domain/            Pure TypeScript, shared by browser and server
    types.ts         Product, Segment, Finding, ValidationRun…
    sources.ts       Curated regulatory excerpts (verbatim, with URLs). No generated text.
    sample.ts        SAMPLE SCENARIO data: fictional product, prewritten German, curated revisions
    compose.ts       Sample generation + deterministic regulatory fact lines
    rules.ts         TrustMap rule engine (deterministic, no model)
  state/store.tsx    Reducer: generate → validate → revise → revalidate; history; localStorage
  lib/               API client, report export
  components/        Shell, header/workflow, UI primitives
  views/             LaunchStudio, LocalisedContent, TrustMap, Sources, History
server/index.ts      Express API: status, structured generation, revision drafts
tests/               node:test suites (run with npm test)
```

**Application states**

```
empty ──load example / type──▶ product ready ──generate──▶ content v1 + validation (auto)
                                     ▲                         │
                     edit product ───┘ (content marked stale)  ▼
                                               select statement → inspector
                                                               │ approve / edit / remove
                                                               ▼
                                         content v2 (validation stale: "recheck")
                                                               │ re-run checks
                                                               ▼
                                         validation v2 + diff (resolved / new / still open)
```

The workflow stepper is derived from state. **Review** completes only when nothing is blocked and every open review item has a reviewer decision, such as escalation to an expert.
