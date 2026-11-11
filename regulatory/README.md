# Module 2 · Regulatory

The curated legal sources the trust checks cite.

| File | What it does |
|---|---|
| `sources.ts` | Exact excerpts from Reg. (EU) 655/2013 (cosmetic claims) and Reg. (EC) 1223/2009 (cosmetic products), each with its official EUR-Lex URL. They were checked against the Official Journal text and are never rewritten by a model. Also lists the **known gaps**: topics with no source loaded, which the app reports as "Can't verify". |

To add a source, add a provision with its exact text and URL. Rules in `/trust/rules.ts` refer to provisions by `sourceId` + `provisionId`.
