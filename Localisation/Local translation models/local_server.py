"""Loopback-only HTTP service for the locally loaded Gemma and NLLB models."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from threading import Lock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from pipeline import USE_MOCK, run_segment  # noqa: E402

# Importing these modules loads each model once for the lifetime of this server.
if not USE_MOCK:
    import mt_gemma  # noqa: E402,F401
    import mt_nllb  # noqa: E402,F401

HOST = "127.0.0.1"
PORT = 8789
MAX_BODY_BYTES = 200_000
translation_lock = Lock()


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path != "/health":
            self.respond(404, {"error": "Not found."})
            return
        self.respond(200, {"ready": True, "model": "TranslateGemma 4B + NLLB-200 600M"})

    def do_POST(self):
        if self.path != "/translate":
            self.respond(404, {"error": "Not found."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > MAX_BODY_BYTES:
                self.respond(413, {"error": "Request body is empty or too large."})
                return

            body = json.loads(self.rfile.read(size))
            segments = body.get("segments") if isinstance(body, dict) else None
            protected_terms = body.get("protected_terms", []) if isinstance(body, dict) else []
            if (
                not isinstance(segments, list)
                or not segments
                or len(segments) > 40
                or not isinstance(protected_terms, list)
                or any(not isinstance(term, str) or len(term) > 200 for term in protected_terms)
            ):
                self.respond(400, {"error": "Invalid translation request."})
                return

            if any(
                not isinstance(segment, dict)
                or not isinstance(segment.get("segment_id"), str)
                or not isinstance(segment.get("source"), str)
                or len(segment["source"]) > 4000
                for segment in segments
            ):
                self.respond(400, {"error": "Invalid translation segment."})
                return

            results = []
            with translation_lock:
                for segment in segments:
                    results.append(
                        run_segment(segment["segment_id"], segment["source"], protected_terms)
                    )
            self.respond(200, {"segments": results})
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            self.respond(400, {"error": "Invalid JSON request."})
        except Exception:
            print("Local translation failed:", file=sys.stderr)
            import traceback

            traceback.print_exc()
            self.respond(500, {"error": "Local model translation failed."})


if __name__ == "__main__":
    print(f"Local translation models ready at http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
