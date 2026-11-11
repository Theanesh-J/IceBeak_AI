
import json
import re
from pathlib import Path


# Find the regulations.json file
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "regulations.json"


# Load the regulatory database
def load_regulations():
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        regulations = json.load(file)

    return regulations


# Split text into individual words
def get_keywords(text):
    return set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))


# Search for relevant regulations
def retrieve_regulations(product_claim, top_k=3):

    regulations = load_regulations()

    claim_keywords = get_keywords(product_claim)

    results = []

    for regulation in regulations:

        # Combine the searchable information
        searchable_text = (
            regulation["topic"] + " " +
            regulation["rule"] + " " +
            regulation["check"]
        )

        regulation_keywords = get_keywords(searchable_text)

        # Calculate how many words match
        matching_words = claim_keywords.intersection(
            regulation_keywords
        )

        score = len(matching_words)

        if score > 0:
            results.append({
                "reg_id": regulation["reg_id"],
                "law": regulation["law"],
                "citation": regulation["citation"],
                "rule": regulation["rule"],
                "severity": regulation["severity"],
                "score": score
            })

    # Sort regulations by relevance
    results.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    # Return the most relevant regulations
    return results[:top_k]


# Test the retrieval system
if __name__ == "__main__":

    claim = input("Enter a product claim: ")

    matches = retrieve_regulations(claim)

    print("\nRelevant regulations found:\n")

    if not matches:
        print("No source found. Human review required.")

    else:
        for match in matches:
            print("------------------------------")
            print("Regulation ID:", match["reg_id"])
            print("Law:", match["law"])
            print("Citation:", match["citation"])
            print("Rule:", match["rule"])
            print("Severity:", match["severity"])
            print("Relevance score:", match["score"])
