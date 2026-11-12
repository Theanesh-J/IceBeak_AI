import json
from adapt import adapt

USE_MOCK = True    # set to False to use the real models
MARKET = "de"      # must match a key in adapt.MARKETS

with open("glossary.json") as f:
    GLOSSARY = json.load(f)

def mock_translate(text):
    return f"[MT] {text}"

def protect(text):
    mapping = {}
    for i, term in enumerate(GLOSSARY["do_not_translate"]):
        token = f"[[T{i}]]"
        if term in text:
            text = text.replace(term, token)
            mapping[token] = term
    return text, mapping

def restore(text, mapping):
    for token, term in mapping.items():
        text = text.replace(token, term)
    return text

def run_segment(segment_id, source):
    protected, mapping = protect(source)
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