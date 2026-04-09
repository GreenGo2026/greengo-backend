# test_gemini.py
# Run from project root: python test_gemini.py
from __future__ import annotations

import asyncio
import os

import httpx
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load .env — must be in the same directory you run the script from
# ---------------------------------------------------------------------------

load_dotenv(dotenv_path=".env", override=True)

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")

# ---------------------------------------------------------------------------
# Diagnostic header
# ---------------------------------------------------------------------------

print("=" * 60)
print("GreenGo — Gemini Dual-Auth Test")
print("=" * 60)
print(f"Key length  : {len(GEMINI_API_KEY)}")
print(f"Key preview : {GEMINI_API_KEY[:8]}…{GEMINI_API_KEY[-4:] if len(GEMINI_API_KEY) >= 8 else '???'}")
print("=" * 60)

if not GEMINI_API_KEY:
    raise SystemExit(
        "❌  GEMINI_API_KEY is empty.\n"
        "    Check your .env file — no quotes, no trailing spaces."
    )

# ---------------------------------------------------------------------------
# Request config
# ---------------------------------------------------------------------------

_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    f"/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
)

_HEADERS: dict[str, str] = {
    "Content-Type":   "application/json; charset=utf-8",
    "x-goog-api-key": GEMINI_API_KEY,          # dual-auth
}

_PAYLOAD: dict = {
    "contents": [
        {
            "parts": [
                {
                    "text": (
                        "Reply with the single word GREENGO_OK and nothing else. "
                        "No punctuation, no explanation."
                    )
                }
            ]
        }
    ]
}


# ---------------------------------------------------------------------------
# Async test runner
# ---------------------------------------------------------------------------

async def run_test() -> None:
    print(f"\n🚀  POST → {_URL[:80]}…\n")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(_URL, json=_PAYLOAD, headers=_HEADERS)

    print(f"HTTP Status : {response.status_code}")
    print(f"Raw body    :\n{response.text}\n")

    if response.status_code == 200:
        data = response.json()
        try:
            reply = (
                data["candidates"][0]["content"]["parts"][0]["text"].strip()
            )
            print(f"✅  Gemini replied: '{reply}'")
            if "GREENGO_OK" in reply:
                print("✅  TEST PASSED — Dual-auth is working correctly.")
            else:
                print("⚠️   TEST WARNING — Got 200 but unexpected content.")
        except (KeyError, IndexError) as exc:
            print(f"⚠️   Could not parse response: {exc}")
    else:
        try:
            err = response.json().get("error", {})
            print(f"❌  TEST FAILED — {err.get('code')} {err.get('status')}: {err.get('message')}")
        except Exception:
            print(f"❌  TEST FAILED — {response.text}")


if __name__ == "__main__":
    asyncio.run(run_test())