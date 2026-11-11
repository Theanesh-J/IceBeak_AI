from mlx_lm import load, generate

MODEL_ID = "mlx-community/translategemma-4b-it-8bit"
print("Loading model...", flush=True)
model, tokenizer = load(MODEL_ID)
try:
    tokenizer.add_eos_token("<end_of_turn>")   # stop generation at end of turn
except Exception:
    pass
print("Model loaded.", flush=True)

def clean(text):
    return text.split("<end_of_turn>")[0].strip()

def translate_gemma(text, src="en", tgt="de-DE"):
    messages = [{
        "role": "user",
        "content": [{
            "type": "text",
            "source_lang_code": src,
            "target_lang_code": tgt,
            "text": text,
        }],
    }]
    prompt = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=False
    )
    return clean(generate(model, tokenizer, prompt=prompt, max_tokens=256))

if __name__ == "__main__":
    tests = [
        "Our organic face cream is handmade in England.",
        "Free UK delivery on orders over £30.",
    ]
    for t in tests:
        print(t, "->", translate_gemma(t), flush=True)
