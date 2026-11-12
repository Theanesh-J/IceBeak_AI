import json, re

# Source-language terms that are often restricted or regulated
RISKY_CLAIMS = {
    "organic": "'organic'/'bio' is a regulated term; check certification rules",
    "natural": "'natural' claims can be restricted; check labelling rules",
    "bio": "'bio' is a regulated term in the EU",
    "anti-ageing": "needs substantiation",
    "anti-aging": "needs substantiation",
    "hypoallergenic": "needs substantiation",
    "dermatologically tested": "needs substantiation",
    "clinically proven": "needs substantiation",
    "cruelty-free": "needs substantiation",
    "vegan": "check vegan labelling rules",
    "cure": "medical claim: may reclassify the product",
    "treat": "possible medical claim",
    "heal": "possible medical claim",
    "100%": "absolute claims need substantiation",
    "eco-friendly": "environmental claims are regulated",
}

# Words that read as hype and may need toning down or substantiation
HYPE_WORDS = ["best", "amazing", "revolutionary", "miracle", "perfect",
              "ultimate", "world's", "#1", "guaranteed", "unbeatable"]

# Per-market cultural settings. Add a market by adding an entry.
MARKETS = {
    "de": {
        "currency_style": "{n} £",          # German style: 30 £
        "decimal": ",",
        "informal_tokens": ["du", "dich", "dir", "dein", "deine", "deiner", "deinen"],
        "informal_note": "informal address (du) used; check this matches the brand voice",
    },
}

def count_required(text, glossary):
    return sum(1 for t in glossary.get("preferred", {}).values() if t.lower() in text.lower())

def fix_currency(text, market):
    style = MARKETS.get(market, {}).get("currency_style")
    if not style:
        return text, False
    dec = MARKETS[market]["decimal"]
    def repl(m):
        n = m.group(1).replace(".", dec) if dec != "." else m.group(1)
        return style.format(n=n)
    new = re.sub(r"£\s?(\d+(?:[.,]\d+)?)", repl, text)
    return new, new != text

def adapt(source, translation, reference, glossary, market="de"):
    changes, claims = [], []
    flagged = False
    dnt = glossary.get("do_not_translate", [])
    pref = glossary.get("preferred", {})

    # 1. Choose the candidate that follows the glossary best
    chosen = translation
    if count_required(reference, glossary) > count_required(translation, glossary):
        chosen = reference
        changes.append("Used the second model's translation: it follows the required glossary terms better")

    # 2. Required glossary terms
    for en_term, target in pref.items():
        if en_term.lower() in source.lower() and target.lower() not in chosen.lower():
            changes.append(f"FLAG: required term '{target}' (for '{en_term}') missing from both translations")
            flagged = True

    # 3. Protected terms must survive
    for term in dnt:
        if term in source and term not in chosen:
            changes.append(f"FLAG: protected term '{term}' missing from output")
            flagged = True

    # 4. Currency formatting for the market
    chosen, fixed = fix_currency(chosen, market)
    if fixed:
        changes.append("Reformatted currency to the local convention")

    # 5. Risky claims in the source
    low = source.lower()
    for term, reason in RISKY_CLAIMS.items():
        if re.search(r"\b" + re.escape(term) + r"\b", low) or (term == "100%" and term in low):
            claims.append(f"'{term}': {reason}")

    # 6. Hype wording in the source
    for w in HYPE_WORDS:
        if w in low:
            changes.append(f"FLAG: source uses '{w}'; tone may read as exaggerated or need substantiation")
            flagged = True

    # 7. Informal address in the output (market-specific)
    cfg = MARKETS.get(market, {})
    tokens = set(re.findall(r"\w+", chosen.lower()))
    if any(t in tokens for t in cfg.get("informal_tokens", [])):
        changes.append("FLAG: " + cfg["informal_note"])
        flagged = True

    # 8. Length check (translations can overflow listing fields)
    if len(chosen) > 1.5 * max(len(source), 1):
        changes.append("FLAG: translation is much longer than the source; check it fits titles and fields")
        flagged = True

    # 9. Models disagree
    disagree = translation.strip() != reference.strip()
    if disagree:
        changes.append("Models produced different translations: review recommended")

    return {
        "localised": chosen,
        "changes": changes,
        "claims_to_check": claims,
        "needs_native_review": bool(flagged or disagree or claims),
    }

if __name__ == "__main__":
    glossary = json.load(open("glossary.json"))
    out = adapt(
        "BrandName organic face cream, handmade in England. Free UK delivery over £30.",
        "BrandName Bio-Gesichtspflege, handgefertigt in England. Kostenlose Lieferung ab £30.",
        "BrandName organische Gesichtscreme, handgefertigt in England. Kostenlose Lieferung ab £ 30.",
        glossary,
    )
    print(json.dumps(out, indent=2, ensure_ascii=False))