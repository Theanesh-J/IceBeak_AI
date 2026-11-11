import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

device = "mps" if torch.backends.mps.is_available() else "cpu"
NAME = "./models/nllb-600M"

tok = AutoTokenizer.from_pretrained(NAME, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(NAME).to(device)

def translate_nllb(texts, tgt="deu_Latn"):
    inputs = tok(texts, return_tensors="pt", padding=True, truncation=True).to(device)
    with torch.no_grad():
        out = model.generate(
            **inputs,
            forced_bos_token_id=tok.convert_tokens_to_ids(tgt),
            max_new_tokens=256,
            num_beams=4,
        )
    return tok.batch_decode(out, skip_special_tokens=True)

if __name__ == "__main__":
    tests = [
        "Our organic face cream is handmade in England.",
        "Free UK delivery on orders over £30.",
    ]
    for src, out in zip(tests, translate_nllb(tests)):
        print(src, "->", out)