# ProofLingo: Local Translation Mode

ProofLingo now offers three ways to generate German content. The new **Local** mode runs two open translation models on the team laptop and compares them, so every sentence gets an independent second opinion.

## Modes

| Mode | How it works | Needs |
|---|---|---|
| **Sample** | Prewritten translations, no model | Nothing |
| **Anthropic** | Hosted model generates the German | API key |
| **Local** (new) | TranslateGemma and NLLB translate on this laptop | Python service running |

Hosted Anthropic mode remains available. Product facts (size, INCI, Responsible Person, safety report, CPNP) stay deterministic in every mode, and a model never writes them.

## How Local mode works

1. The local service loads **TranslateGemma** and **NLLB** once at startup.
2. It translates the supplied categories, descriptions and claims.
3. **Product names are protected**, so models cannot alter them.
4. **Both models translate every source segment.**
5. A **glossary-based heuristic** picks one translation. On a tie it defaults to TranslateGemma.
6. If the two models disagree, the segment is **flagged**.
7. **TrustMap** still checks the selected text.

## What the review screen shows

- The English input
- Both German outputs
- Word-level differences, highlighted
- Which model was selected
- The reason it was selected

## Why these features matter

| Feature | Why it matters |
|---|---|
| Two independent models | One model checking itself is weak evidence. Two different model types agreeing is stronger, and disagreement points to sentences a human should review. |
| Disagreement flags | Fluent German can hide errors. Flags catch cases like a dropped word that read naturally. |
| Visible differences and selection reason | Reviewers can see why a translation was chosen, not just what was chosen. This is the "where outputs can and cannot be trusted" part of the brief. |
| Glossary-based selection | Required product terms are followed, and the choice is explainable and repeatable. |
| Protected product names | Brand and product names survive translation unchanged. |
| TrustMap on selected text | Whatever is chosen is still checked against evidence and rules, whichever model wrote it. |
| Deterministic product facts | Regulatory lines are never written by a model, so they cannot be hallucinated. |
| Runs locally | No per-call cost, no API key, and product data stays on the machine. |
| Hosted mode kept | Teams that prefer a hosted model can still use it. |

## Requirements and limits

- Local mode needs the **Python service running on this laptop**.
- The selection heuristic is glossary-based. It does not judge fluency or meaning, so flagged disagreements still need human review.
- The local models are small open models. They are used for cross-checking and access, not claimed to outperform hosted models.
- If the service is not running, use Sample or Anthropic mode.

## Setup and tests

- Setup instructions: [link to setup docs]
- Comparison tests: [link to tests]
