# Translation module (Module 1)

Takes an English product text segment and returns a localised version plus
data the other modules need.

## How to use it from your code

```python
from pipeline import run_segment

result = run_segment("listing_01", "BrandName organic face cream, handmade in England.")
```

`run_segment(segment_id, source)` returns one dict per segment:

```json
{
  "segment_id": "listing_01",
  "source": "BrandName organic face cream, handmade in England.",
  "mt": {
    "nllb": "...",     // NLLB-200 translation
    "gemma": "..."     // TranslateGemma translation
  },
  "localised": "...",          // the translation we propose to ship
  "adaptation_notes": [],      // what the module changed or flagged
  "claims_to_check": [],       // source claims that may need substantiation
  "needs_native_review": false,
  "reg_flags": [],             // FILLED BY Module 2 (regulatory)
  "trust": {}                  // FILLED BY Module 3 (trust layer)
}
```

## Who reads and writes what

| Field | Written by | Used by |
|---|---|---|
| `source`, `mt.nllb`, `mt.gemma`, `localised`, `adaptation_notes` | Module 1 (translation) | Everyone |
| `reg_flags` | Module 2 (regulatory) | UI, trust layer |
| `trust` | Module 3 (trust) | UI |

**Convention for Modules 2 and 3:** write a function that takes the segment
dict and returns it with your field filled in, e.g.
`segment = check_regulations(segment)`. The UI then chains
`run_segment → check_regulations → score_trust`. Don't change field names
without telling the team.

## Mock mode (no models needed)

`pipeline.py` has `USE_MOCK = True` by default. In mock mode it returns fake
translations like `[MT] ...` in the same JSON shape, instantly. **Build and
test your module against mock mode.** Only the machine running the real
translation needs the models.

Set `USE_MOCK = False` to use the real models.

## What happens in real mode

1. **Protect:** terms in `glossary.json` → `do_not_translate` (brand names)
   are swapped for placeholders so the models can't change them.
2. **Translate:** the text goes to NLLB-200 (600M) and to TranslateGemma 4B.
3. **Restore:** placeholders are swapped back.
4. **Output:** the JSON above. For now `localised` is the TranslateGemma
   output.

The first call loads both models and takes about a minute. After that, calls
are quick. In a UI, load the models once at startup, not per click.

## Requirements and setup (real mode only)

- **Apple Silicon Mac required** for TranslateGemma. It runs on MLX, which does
  not work on Windows, Linux or Intel Macs. Teammates on other machines should
  use mock mode, or call the translator from the machine that runs it.
- About 7 GB of free RAM for both models.
- Both models run in the same virtual environment. Dependencies are pinned in
  `requirements.txt`.

From the repository root:

```bash
cd "Localisation/Translation module"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
huggingface-cli download facebook/nllb-200-distilled-600M --local-dir models/nllb-600M
```

NLLB is loaded from `models/nllb-600M`, so download it to that directory. The
TranslateGemma model is downloaded to the Hugging Face cache automatically on
the first real translation.

## Current status and limits

- **Done:** NLLB and TranslateGemma translate English → German; glossary
  protection works; JSON output.
- `adapt.py` compares the model translations against glossary preferences,
  selects a candidate, and flags claims that may need substantiation.
- **German only for now.** Target language codes are hardcoded in `mt_nllb.py`
  (`deu_Latn`) and `mt_gemma.py` (`de-DE`). They will move into config once the
  market is confirmed.
- **Known issue:** the two models can disagree. For example, on "organic
  face cream" one drops the word "cream" and the other gives a stilted
  literal translation. This is the kind of case Modules 2 and 3 should catch.
- A tokenizer warning appears when TranslateGemma loads. The output looks
  fine, so ignore it.
