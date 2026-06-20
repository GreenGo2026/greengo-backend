"""
GreenGo — Admin Credentials Setup
===================================
Run this script ONCE locally to generate:
  • ADMIN_PASSWORD_HASH  — pbkdf2_sha256 hash of your admin password
  • ADMIN_TOTP_SECRET    — base32 secret for Google Authenticator

Then copy both values to Railway environment variables and redeploy.

Usage:
    python setup_admin_credentials.py

Requirements (install locally if needed):
    pip install pyotp passlib
"""

import getpass
import sys

try:
    import pyotp
    from passlib.context import CryptContext
except ImportError:
    print("Missing packages. Run: pip install pyotp passlib")
    sys.exit(1)

_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def main() -> None:
    print("\n" + "=" * 60)
    print("  GreenGo Admin Credentials Setup")
    print("=" * 60)

    # ── Password ─────────────────────────────────────────────────────────────
    print("\n[1/2] Choose a strong admin password (min 12 chars).")
    print("      It will NEVER be stored — only its bcrypt hash is kept.\n")

    while True:
        pw  = getpass.getpass("  Enter password: ")
        pw2 = getpass.getpass("  Confirm password: ")
        if pw != pw2:
            print("  ✗ Passwords do not match. Try again.\n")
            continue
        if len(pw) < 12:
            print("  ✗ Password too short (minimum 12 characters).\n")
            continue
        break

    pw_hash = _ctx.hash(pw)
    print(f"\n  ✓ Hash généré (pbkdf2_sha256).\n")

    # ── TOTP Secret ──────────────────────────────────────────────────────────
    print("[2/2] Generating TOTP secret for Google Authenticator...\n")
    secret = pyotp.random_base32()
    totp   = pyotp.TOTP(secret)
    uri    = totp.provisioning_uri(name="GreenGo Admin", issuer_name="GreenGo Market")
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={uri}"

    # ── Output ───────────────────────────────────────────────────────────────
    print("=" * 60)
    print("  COPY THESE VALUES TO RAILWAY ENVIRONMENT VARIABLES")
    print("=" * 60)
    print(f"\nADMIN_PASSWORD_HASH={pw_hash}")
    print(f"\nADMIN_TOTP_SECRET={secret}")
    print("\n" + "=" * 60)

    print("\n[Google Authenticator setup]")
    print(f"  1. Open Google Authenticator on your phone.")
    print(f"  2. Tap '+' → 'Scan a QR code'.")
    print(f"  3. Open this URL in your browser and scan the QR image:")
    print(f"\n     {qr_url}\n")
    print(f"  4. Or enter the secret manually: {secret}")
    print(f"\n  Account name will show as: GreenGo Admin (GreenGo Market)")

    print("\n[Next steps]")
    print("  1. Add ADMIN_PASSWORD_HASH to Railway env vars.")
    print("  2. Add ADMIN_TOTP_SECRET  to Railway env vars.")
    print("  3. Redeploy Railway backend.")
    print("  4. Test login at /admin or /super-admin.")
    print("  5. Optionally add these values to your local .env for dev.\n")

    # ── Verify TOTP works ────────────────────────────────────────────────────
    print("[Verification] Enter the 6-digit code from Google Authenticator to confirm setup:")
    code = input("  Code: ").strip()
    if totp.verify(code, valid_window=1):
        print("  ✓ TOTP verified! Your setup is correct.\n")
    else:
        print("  ✗ Code incorrect — check your phone clock or re-scan QR.\n")


if __name__ == "__main__":
    main()
