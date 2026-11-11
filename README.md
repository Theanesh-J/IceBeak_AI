# [Project Name]: Trust-Aware Market Entry Pipeline

**The 48 Group Hackathon, Track 2: Scaling Globally with AI**

## The challenge
Help a UK SME take a product into a new international market by localising its listings, marketing and documentation (language and culture), checking them against local regulations, and clearly flagging where the AI's outputs can and cannot be trusted.

## Our approach
We don't just translate. We tell the SME **which outputs they can ship, which need a human, and why.**

```
Input (listing, marketing, doc)
   ↓
[1] Localise: LLM + NLLB, product glossary, cultural adaptation notes
   ↓
[2] Regulatory check: RAG over curated laws, flags claims with citations
   ↓
[3] Trust layer: back-translation, glossary consistency, model disagreement,
    citation grounding → green / amber / red + reasons
   ↓
[4] UI: side-by-side output, traffic-light flags, human-review queue, report export
```

## Scope (decided)
- **Product:** [TBD]
- **Target market / language:** [TBD]
- **Demo inputs:** one product listing, one marketing piece, one document
- **Stretch only if stable by hour 14:** second market via config swap

## Team and ownership
| # | Name | Role | Owns | Status |
|---|------|------|------|--------|
| 1 | [] | Lead, product and pitch | Scope, demo data, slides, demo script, integration decisions | ⬜ |
| 2 | Theanesh | Localisation | Module 1: translation and cultural adaptation prompts, NLLB comparison, glossary | ⬜ |
| 3 | Adil | Regulatory RAG | Module 2: curated law excerpts, retriever, flags with exact citations | ⬜ |
| 4 | Harun | Trust and evaluation | Module 3: trust signals, scoring, eval numbers (FLORES-200 or own test set) | ⬜ |
| 5 | Yariel | Frontend and integration | Module 4: UI, wiring modules together, deployment and backup demo video | 🟩 |

Status key: ⬜ not started · 🟨 in progress · 🟩 working with mock data · ✅ integrated

## Shared data contract
Every module reads and writes this shape. Don't change it without telling the team.//to be confirmed
```json
{
  "segment_id": "listing_03",
  "source": "...",
  "localised": "...",
  "reg_flags": [{"issue": "...", "citation": "Reg X, Art. Y", "severity": "high"}],
  "trust": {"score": 0.72, "status": "amber", "reasons": ["back-translation drift", "no source found for claim"]}
}
```

## Timeline (24h)
| Hours | Goal | Done |
|---|---|---|
| 0–1 | Pick product and market, agree contract, set up repo and keys | ⬜ |
| 1–6 | Parallel build, each module standalone with mock data | ⬜ |
| **6** | **Checkpoint: every module returns valid JSON for ≥1 segment** | ⬜ |
| 6–12 | Integrate end to end | ⬜ |
| **12–14** | **Working e2e demo exists. Sleep in shifts.** | ⬜ |
| 14–19 | Improve quality, expand regulation coverage, tune thresholds, run eval | ⬜ |
| 19–21 | **Feature freeze.** Slides, eval chart | ⬜ |
| 21–23 | Rehearse pitch 3+ times, record backup demo video | ⬜ |
| 23–24 | Buffer. No new code. | ⬜ |

## Principles
- **Honesty over polish.** If no regulation source is retrieved, say "no source found". Never guess.
- **Not legal advice.** Regulatory flags are decision support. Uncertain output goes to human review.
- **Few, explainable trust signals.** Every signal must be describable in one sentence.
- **Curate, don't crawl.** 10–20 relevant legal excerpts beat whole statutes.
- **Scope discipline.** One product, one market, until the e2e demo works.

## Demo checklist
- [ ] Live run: listing in → localised output + flags out
- [ ] One red flag and one green flag, explained
- [ ] Eval numbers showing where quality is weaker
- [ ] Clear limits statement (what the tool can't be trusted for)
- [ ] Business case: time and cost saved vs agency or lawyer (eBay study: +17.5% exports)
- [ ] Backup demo video recorded

## Key resources
- UK Trade Tariff · UK legislation · EUR-Lex · China National Laws DB · China-Britain Business Council
- Meta NLLB (translation) · FLORES-200 (quality testing) · LangChain / LlamaIndex (RAG)
- Research: Brynjolfsson et al. (eBay MT study), WTO *Trading with Intelligence*, MuBench, mSTEB

## Repo structure
```
/localise     # Module 1
/regulatory   # Module 2
/trust        # Module 3
/app          # Module 4 (UI + integration)
/data         # demo inputs, glossary, curated regulations
/eval         # test sets and results
```

Each folder has a README describing what's in it. Today: `/localise/compose.ts`, `/regulatory/sources.ts`, `/trust/rules.ts`, `/data` (shared types and sample data) and `/eval` (tests). They're all TypeScript and wired into the working app in `/app`.

## Run it
Live demo: https://prooflingo-ieee.netlify.app

The working demo lives in `/app` (Module 4). It needs Node 22+ and runs without any API key.

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173 and click **Use the example product → Generate German content → Review and fix**.

- **Live AI (optional):** copy `app/.env.example` to `app/.env`, add your own `ANTHROPIC_API_KEY`, then restart. `.env` is git-ignored, so never commit keys.
- **Checks:** `npm test` · `npm run typecheck` · `npm run build`
- **More:** setup details, the 90-second demo script, and how each module plugs in are in [`app/README.md`](app/README.md).
