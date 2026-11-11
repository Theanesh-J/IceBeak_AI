"""
ProofLingo - TrustMap (AI app)

Streamlit + LangChain + ChatOpenAI (gpt-4o-mini). Launched from main.py.
1. Loads the products saved in main.py (products.csv).
2. The AI pulls out every claim, matches it to the supplied evidence, judges it and
   writes a safer, localised version.
3. The TrustMap model scores each claim from its factors, blends that with the AI's
   judgement into a probability, and rolls claims up into a 0-100 trust score.
4. Results are saved to trustmap_results.csv for main.py's Results page.
"""

import math
import os
import re
from typing import List, Literal

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st
from pydantic import BaseModel, Field

os.environ["OPENAI_API_KEY"] = "key"

matplotlib.use("Agg")  # non-interactive backend for Streamlit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_CSV = os.path.join(BASE_DIR, "products.csv")
RESULTS_CSV = os.path.join(BASE_DIR, "trustmap_results.csv")


# ---------------------------------------------------------------------------
# 1. FACTORS
# ---------------------------------------------------------------------------

# How strong is the evidence the business supplied for the claim? (0-1)
EVIDENCE_LEVELS = {
    "none": 0.0,        # nothing provided
    "internal": 0.35,   # own lab notes, supplier spec sheet
    "consumer": 0.60,   # consumer perception / self-assessment study
    "clinical": 0.85,   # independent clinical or dermatological study
    "regulatory": 1.0,  # official source (e.g. EU CosIng, approved ingredient list)
}

# Claim-risk patterns. risk 1.0 = cosmetics must not make this kind of claim at all;
# 0.5 = allowed only with solid substantiation.
RISK_RULES = [
    {
        "name": "Medicinal claim",
        "pattern": r"\b(cure[sd]?|heal[s]?|treat[s]?|treatment|eczema|psoriasis|rosacea|dermatitis|"
                   r"prevents? (acne|infection)|anti-?bacterial|anti-?inflammatory|medical)\b",
        "risk": 1.0,
        "why": "Cosmetics can't claim to treat or cure conditions (EU Reg. 1223/2009; "
               "in Germany also the Heilmittelwerbegesetz).",
        "fix": "Describe the cosmetic effect instead, e.g. 'helps soothe the look of dry, irritated skin'.",
    },
    {
        "name": "'Free from' / chemical-free",
        "pattern": r"\b(chemical[- ]free|free from|no nasties|toxin[- ]free|paraben[- ]free|non[- ]toxic)\b",
        "risk": 0.5,
        "why": "EU claims guidance treats 'free from' claims that denigrate legal ingredients as misleading, "
               "and 'chemical-free' is never true.",
        "fix": "Drop it, or state a factual benefit, e.g. 'formulated for sensitive skin'.",
    },
    {
        "name": "Proof / testing claim",
        "pattern": r"\b(clinically|dermatologically|scientifically|proven|tested|hypoallergenic|recommended by)\b",
        "risk": 0.5,
        "why": "Testing and proof claims must be backed by a study that matches the wording exactly "
               "(EU Reg. 655/2013, evidential support).",
        "fix": "Quote the actual study, e.g. 'In a 4-week study with 32 people, 78% said their skin felt smoother'.",
    },
    {
        "name": "Natural / organic",
        "pattern": r"\b(100% natural|all[- ]natural|organic|natural)\b",
        "risk": 0.5,
        "why": "Natural/organic wording must be accurate and is often judged against ISO 16128 or a certifier.",
        "fix": "Give the figure and basis, e.g. '95% ingredients of natural origin (ISO 16128)'.",
    },
]

# Absolute / exaggerated language (pushes towards expert review even with evidence)
ABSOLUTE_PATTERN = r"\b(permanent(ly)?|guarantee[sd]?|instantly|100%|never|always|forever|best|miracle|" \
                   r"completely|eliminates?|erases?|all skin types)\b"

NUMBER_PATTERN = r"\d+\s?(%|percent|x|times|days?|weeks?|hours?)"

# ---------------------------------------------------------------------------
# 2. MODEL WEIGHTS (logistic). Tune these with your validation data.
# ---------------------------------------------------------------------------
WEIGHTS = {
    "intercept": 0.9,
    "evidence": 3.2,             # stronger evidence -> more trustworthy
    "has_source": 0.8,           # a citable source/link was supplied
    "risk": -3.0,                # risky claim type
    "absolute": -2.5,            # exaggerated / absolute wording
    "unsupported_number": -1.0,  # a figure (40%, 7 days) with weak evidence
}

SUPPORTED_THRESHOLD = 0.75
EVIDENCE_GAP_THRESHOLD = 0.5


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


# ---------------------------------------------------------------------------
# 3. SCORING
# ---------------------------------------------------------------------------
def extract_features(claim, evidence, source):
    text = claim.lower()
    evidence_value = EVIDENCE_LEVELS.get(evidence.strip().lower(), 0.0)

    matched = [r for r in RISK_RULES if re.search(r["pattern"], text)]
    risk = max((r["risk"] for r in matched), default=0.0)

    absolute = 1.0 if re.search(ABSOLUTE_PATTERN, text) else 0.0
    has_number = bool(re.search(NUMBER_PATTERN, text))

    features = {
        "evidence": evidence_value,
        "has_source": 1.0 if source.strip() else 0.0,
        "risk": risk,
        "absolute": absolute,
        "unsupported_number": 1.0 if has_number and evidence_value < 0.6 else 0.0,
    }
    return features, matched


def classify(probability, features):
    """Apply hard rules and thresholds. Returns (probability, TrustMap status)."""
    prohibited = features["risk"] >= 1.0
    if prohibited:
        probability = min(probability, 0.30)  # evidence can't rescue a banned claim type

    if prohibited:
        status = "Needs expert review"
    elif probability >= SUPPORTED_THRESHOLD:
        status = "Supported"
    elif features["evidence"] < EVIDENCE_GAP_THRESHOLD:
        status = "Lacks evidence"
    else:
        status = "Needs expert review"
    return probability, status


def product_trust_score(results):
    """Roll claim probabilities up into a 0-100 score and a band."""
    if not results:
        return 0, "No claims"
    weights = [1 + 2 * r["factors"]["risk"] for r in results]
    weighted = sum(w * r["probability"] for w, r in zip(weights, results)) / sum(weights)
    score = round(weighted * 100)
    # A product can't be 'ready' while any claim is unresolved
    if any(r["status"] == "Needs expert review" for r in results):
        score = min(score, 60)
    elif any(r["status"] == "Lacks evidence" for r in results):
        score = min(score, 74)
    band = "Ready to publish" if score >= 75 else "Fix before publishing" if score >= 50 else "High risk"
    return score, band


def score_claim(claim, evidence="none", source=""):
    features, matched = extract_features(claim, evidence, source)

    contributions = {k: WEIGHTS[k] * v for k, v in features.items()}
    logit = WEIGHTS["intercept"] + sum(contributions.values())
    probability = sigmoid(logit)

    probability, status = classify(probability, features)

    # Plain-English reasons, ordered by how much they hurt the score
    reasons = [r["why"] for r in matched]
    if features["absolute"]:
        reasons.append("Uses absolute or exaggerated wording that is hard to prove.")
    if features["unsupported_number"]:
        reasons.append("Quotes a figure without a study strong enough to back it.")
    if features["evidence"] == 0:
        reasons.append("No evidence supplied.")
    if not reasons:
        reasons.append("Low-risk wording backed by the evidence supplied.")

    fixes = [r["fix"] for r in matched]
    if features["absolute"] and not fixes:
        fixes.append("Soften the wording, e.g. 'helps', 'can visibly improve', and remove guarantees.")
    if status == "Lacks evidence" and not fixes:
        fixes.append("Add a study, test report or official source, or remove the claim.")

    return {
        "claim": claim,
        "evidence": evidence,
        "source": source,
        "probability": round(probability, 3),
        "status": status,
        "factors": features,
        "contributions": {k: round(v, 2) for k, v in contributions.items()},
        "reasons": reasons,
        "suggested_fix": fixes[0] if fixes else "",
    }


# Final probability = 60% rule-based factors + 40% AI judgement
RULE_WEIGHT, AI_WEIGHT = 0.6, 0.4

STATUS_COLOURS = {"Supported": "#d4edda", "Lacks evidence": "#fff3cd", "Needs expert review": "#f8d7da"}
STATUS_ICONS = {"Supported": "🟢", "Lacks evidence": "🟡", "Needs expert review": "🔴"}

DEMO_PRODUCTS = pd.DataFrame([
    {"Product": "Rosehip Glow Serum",
     "Description": "Visibly brightens skin in 4 weeks. Clinically proven to reduce wrinkles by 40%. "
                    "Made with cold-pressed rosehip oil.",
     "Evidence": "Independent clinical study, 30 participants, 2025: brightness improved after 4 weeks. "
                 "Rosehip oil listed in EU CosIng as Rosa Canina Fruit Oil."},
    {"Product": "Calm Barrier Moisturiser",
     "Description": "Moisturises for up to 24 hours. Heals eczema and dermatitis. Chemical-free and non-toxic.",
     "Evidence": "Corneometer consumer test, 20 participants: hydration up to 24 hours. Customer case reports."},
    {"Product": "Clear Skin Gel",
     "Description": "Helps reduce the appearance of blemishes. Permanently eliminates spots. "
                    "Dermatologically tested.",
     "Evidence": "Self-assessment study, 25 participants: appearance of blemishes reduced. "
                 "Dermatologically tested by Dermatest, report 2025. Internal lab notes on spots."},
])


# ---------------------------------------------------------------------------
# AI layer (LangChain + OpenAI, structured output)
# ---------------------------------------------------------------------------
class ExtractedClaim(BaseModel):
    claim: str = Field(description="The claim exactly as written in the description")
    evidence_level: Literal["none", "internal", "consumer", "clinical", "regulatory"] = Field(
        description="Strongest evidence in the supplied evidence notes that directly supports THIS claim. "
                    "'none' if nothing supplied matches it. Never invent evidence.")
    source: str = Field(description="The piece of supplied evidence used, or empty string")
    ai_probability: float = Field(ge=0, le=1, description="Your probability (0-1) that this claim is "
                                  "acceptable to publish in the target market as written")
    reason: str = Field(description="One or two plain-English sentences explaining the judgement, "
                        "naming the relevant rule where there is one")
    safer_revision_en: str = Field(description="Safer English wording, or the original if already fine")
    localised: str = Field(description="The safer wording translated for the target market's language")


class ProductAnalysis(BaseModel):
    claims: List[ExtractedClaim]


SYSTEM_PROMPT = """You are TrustMap, the compliance checker inside ProofLingo, a tool that helps small UK
businesses sell abroad. You review cosmetic product claims for {country}.

Rules to apply:
- EU Cosmetics Regulation (EC) 1223/2009 and the common criteria for claims in Regulation (EU) 655/2013:
  legal compliance, truthfulness, evidential support, honesty, fairness, informed decision-making.
- Cosmetics must not claim to treat, cure or prevent a disease (in Germany also the Heilmittelwerbegesetz,
  and the UWG on misleading advertising).
- 'Free from' and 'chemical-free' claims that denigrate legal ingredients are misleading.
- Proof/testing/percentage claims need a study that matches the exact wording.

Instructions:
- Split the description into individual claims (one statement each). Ignore pure product names.
- Match each claim ONLY against the evidence notes provided. If nothing matches, evidence_level is 'none'.
- Be strict and consistent. Translate the safer wording into the main language of {country}."""


def get_llm(api_key):
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=api_key)
    return llm.with_structured_output(ProductAnalysis)


def analyse_with_ai(llm, product, description, evidence, country):
    messages = [
        ("system", SYSTEM_PROMPT.format(country=country)),
        ("human", f"Product: {product}\n\nDescription:\n{description}\n\nEvidence notes:\n{evidence or 'None'}"),
    ]
    return llm.invoke(messages).claims


STOPWORDS = {"the", "and", "with", "for", "in", "of", "to", "a", "by", "up", "after", "skin", "your"}


def _evidence_level(text):
    t = text.lower()
    if "cosing" in t or "regulat" in t:
        return "regulatory"
    if "clinical" in t or "dermatest" in t:
        return "clinical"
    if "consumer" in t or "self-assessment" in t or "participants" in t:
        return "consumer"
    return "internal" if t.strip() else "none"


def analyse_offline(description, evidence):
    """Fallback when there is no API key: split sentences, match each claim to the evidence
    note that shares the most words with it."""
    notes = [n.strip() for n in re.split(r"[.;\n]+", evidence or "") if n.strip()]
    claims = []
    for s in (s.strip() for s in re.split(r"[.;\n]+", description) if s.strip()):
        words = set(re.findall(r"[a-z0-9%]+", s.lower())) - STOPWORDS
        best, overlap = "", 0
        for note in notes:
            n = len(words & (set(re.findall(r"[a-z0-9%]+", note.lower())) - STOPWORDS))
            if n > overlap:
                best, overlap = note, n
        level = _evidence_level(best) if overlap else "none"
        claims.append(ExtractedClaim(claim=s, evidence_level=level, source=best if overlap else "",
                                     ai_probability=0.5, reason="Offline mode: no AI judgement.",
                                     safer_revision_en=s, localised="(add an API key for translation)"))
    return claims


# ---------------------------------------------------------------------------
# Combine AI output with the probability model
# ---------------------------------------------------------------------------
def build_result(c: ExtractedClaim, use_ai: bool):
    rule = score_claim(c.claim, c.evidence_level, c.source)
    if use_ai:
        blended = RULE_WEIGHT * rule["probability"] + AI_WEIGHT * c.ai_probability
    else:
        blended = rule["probability"]
    probability, status = classify(blended, rule["factors"])

    reasons = ([c.reason] if use_ai else []) + rule["reasons"]
    return {
        **rule,
        "rule_probability": rule["probability"],
        "ai_probability": round(c.ai_probability, 3) if use_ai else None,
        "probability": round(probability, 3),
        "status": status,
        "reasons": list(dict.fromkeys(reasons)),  # drop duplicates, keep order
        "suggested_fix": c.safer_revision_en if use_ai else rule["suggested_fix"],
        "localised": c.localised,
    }


def results_dataframe(report):
    return pd.DataFrame([{
        "Status": f"{STATUS_ICONS[r['status']]} {r['status']}",
        "P(ok)": f"{r['probability']:.0%}",
        "Rules": f"{r['rule_probability']:.0%}",
        "AI": "-" if r["ai_probability"] is None else f"{r['ai_probability']:.0%}",
        "Evidence": r["evidence"],
        "Claim": r["claim"],
    } for r in report["claims"]])


def colour_rows(row):
    status = row["Status"].split(" ", 1)[1]
    return [f"background-color: {STATUS_COLOURS[status]}; color: #1b1b1b"] * len(row)


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
st.set_page_config(page_title="ProofLingo TrustMap", page_icon="🗺️", layout="wide")
st.title("ProofLingo TrustMap")
st.write("Check which product claims are supported, which lack evidence and which need expert review "
         "before you publish in a new market.")

with st.sidebar:
    st.header("Settings")
    country = st.selectbox("Target market", ["Germany", "France", "Netherlands", "Spain", "Ireland"])
    api_key = st.text_input("OpenAI API key", type="password",
                            value=os.environ.get("OPENAI_API_KEY", ""),
                            help="Read from the OPENAI_API_KEY environment variable if set.")
    use_ai = st.toggle("Use AI analysis", value=bool(api_key),
                       help="Off = offline rule-based mode, handy if the Wi-Fi fails during the demo.")
    st.caption(f"Final probability = {int(RULE_WEIGHT*100)}% rule factors + {int(AI_WEIGHT*100)}% AI judgement.")

st.subheader("1. Products")
if os.path.exists(PRODUCTS_CSV):
    products = pd.read_csv(PRODUCTS_CSV).fillna("")
    st.caption("These are the products from ProofLingo. Change them on the Products page, "
               "or edit them here for this run.")
else:
    products = DEMO_PRODUCTS
    st.caption("Showing three demo products. Add your own on the Products page in ProofLingo.")

products = st.data_editor(products, num_rows="dynamic", use_container_width=True,
                          column_config={"Description": st.column_config.TextColumn(width="large"),
                                         "Evidence": st.column_config.TextColumn(width="large")})

if st.button("Run TrustMap", type="primary"):
    if use_ai and not api_key:
        st.error("Add an OpenAI API key in the sidebar, or switch off 'Use AI analysis'.")
        st.stop()

    llm = get_llm(api_key) if use_ai else None
    reports = []
    progress = st.progress(0.0, text="Checking claims...")
    rows = products.dropna(subset=["Product", "Description"]).to_dict("records")

    for i, row in enumerate(rows, start=1):
        try:
            if use_ai:
                claims = analyse_with_ai(llm, row["Product"], row["Description"], row.get("Evidence", ""), country)
            else:
                claims = analyse_offline(row["Description"], row.get("Evidence", ""))
        except Exception as e:
            st.warning(f"AI analysis failed for {row['Product']} ({e}). Using offline mode.")
            claims, used_ai = analyse_offline(row["Description"], row.get("Evidence", "")), False
        else:
            used_ai = use_ai

        results = [build_result(c, used_ai) for c in claims]
        score, band = product_trust_score(results)
        reports.append({"product": row["Product"], "trust_score": score, "band": band, "claims": results})
        progress.progress(i / len(rows), text=f"Checked {row['Product']}")

    progress.empty()
    st.session_state["reports"] = reports

if "reports" in st.session_state:
    reports = st.session_state["reports"]
    st.subheader("2. TrustMap results")

    # Overview chart (matplotlib, as in the original app)
    fig, ax = plt.subplots(figsize=(8, 0.6 + 0.6 * len(reports)))
    colours = ["#2e7d32" if r["trust_score"] >= 75 else "#f9a825" if r["trust_score"] >= 50 else "#c62828"
               for r in reports]
    ax.barh([r["product"] for r in reports], [r["trust_score"] for r in reports], color=colours)
    ax.set_xlim(0, 100)
    ax.axvline(75, linestyle="--", color="grey", linewidth=1)
    ax.set_xlabel("Trust score (75+ = ready to publish)")
    ax.invert_yaxis()
    st.pyplot(fig)

    for report in reports:
        st.markdown(f"### {report['product']}")
        c1, c2 = st.columns([1, 3])
        c1.metric("Trust score", f"{report['trust_score']}/100")
        c2.markdown(f"**{report['band']}**")

        df = results_dataframe(report)
        st.dataframe(df.style.apply(colour_rows, axis=1), use_container_width=True, hide_index=True)

        for r in report["claims"]:
            if r["status"] == "Supported":
                continue
            with st.expander(f"{STATUS_ICONS[r['status']]} {r['claim']}"):
                st.markdown("**Why**")
                for reason in r["reasons"]:
                    st.write(f"- {reason}")
                st.markdown("**Safer wording**")
                st.write(r["suggested_fix"])
                st.markdown(f"**For {country}**")
                st.write(r["localised"])
                st.caption("Score breakdown: " + ", ".join(
                    f"{k} {v:+.2f}" for k, v in r["contributions"].items() if v) +
                    f" (intercept {WEIGHTS['intercept']:+.2f})")

    export = pd.DataFrame([{
        "product": rep["product"], "trust_score": rep["trust_score"], "band": rep["band"],
        "claim": r["claim"], "evidence": r["evidence"], "probability": r["probability"],
        "rule_probability": r["rule_probability"], "ai_probability": r["ai_probability"],
        "status": r["status"], "reasons": " | ".join(r["reasons"]),
        "safer_wording": r["suggested_fix"], "localised": r["localised"],
    } for rep in reports for r in rep["claims"]])
    export.to_csv(RESULTS_CSV, index=False)
    st.success("Results saved. Open the Results page in ProofLingo to see them there too.")
    st.download_button("Download results CSV", export.to_csv(index=False).encode("utf-8"),
                       file_name="trustmap_results.csv", mime="text/csv")