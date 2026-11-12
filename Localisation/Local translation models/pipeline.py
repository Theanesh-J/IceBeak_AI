import json
from pathlib import Path
from adapt import adapt

USE_MOCK = False    # set to False to use the real models
MARKET = "de"      # must match a key in adapt.MARKETS

with (Path(__file__).parent / "glossary.json").open() as f:
    GLOSSARY = json.load(f)

def mock_translate(text):
    return f"[MT] {text}"

def protect(text, extra_terms=None):
    mapping = {}
    terms = list(dict.fromkeys([*GLOSSARY["do_not_translate"], *(extra_terms or [])]))
    terms.sort(key=len, reverse=True)
    for i, term in enumerate(terms):
        if not term:
            continue
        token = f"[[T{i}]]"
        if term in text:
            text = text.replace(term, token)
            mapping[token] = term
    return text, mapping

def restore(text, mapping):
    for token, term in mapping.items():
        text = text.replace(token, term)
    return text

def run_segment(segment_id, source, protected_terms=None):
    protected, mapping = protect(source, protected_terms)
    if USE_MOCK:
        nllb = gem = mock_translate(protected)
    else:
        from mt_nllb import translate_nllb
        from mt_gemma import translate_gemma
        nllb = translate_nllb([protected])[0]
        gem = translate_gemma(protected)
    nllb, gem = restore(nllb, mapping), restore(gem, mapping)
    result = adapt(source, gem, nllb, GLOSSARY, market=MARKET)
    return {
        "segment_id": segment_id,
        "source": source,
        "mt": {"nllb": nllb, "gemma": gem},
        "localised": result["localised"],
        "adaptation_notes": result["changes"],
        "claims_to_check": result["claims_to_check"],
        "needs_native_review": result["needs_native_review"],
        "reg_flags": [],
        "trust": {},
    }

if __name__ == "__main__":
    out = run_segment("listing_01", "BrandName organic face cream, handmade in England.")
    print(json.dumps(out, indent=2, ensure_ascii=False))