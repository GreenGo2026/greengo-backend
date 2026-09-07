"""
Offline verification of the cart-recovery sweep's guards, using fake
collections -- no MongoDB required.

Run: python scripts/verify_cart_recovery.py
"""
from __future__ import annotations

import asyncio
import sys
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

warnings.filterwarnings("ignore")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.routes import cart_sessions as CS  # noqa: E402


class FakeCursor:
    def __init__(self, docs): self._docs = docs
    def __aiter__(self):
        async def gen():
            for d in self._docs:
                yield d
        return gen()


class FakeSessions:
    def __init__(self, docs): self.docs = docs; self.updates = []
    def find(self, query):
        now = datetime.now(timezone.utc)
        lt  = query["created_at"]["$lt"]; gte = query["created_at"]["$gte"]
        out = [
            d for d in self.docs
            if d.get("converted") is False
            and d.get("reminder_sent") is False
            and gte <= d["created_at"] < lt
        ]
        return FakeCursor(out)
    async def update_one(self, flt, update):
        self.updates.append((flt, update))
        target = next((d for d in self.docs if d["_id"] == flt.get("_id")), None)
        class R:
            matched_count = 0
            modified_count = 0
        r = R()
        if target is None:
            return r
        # honour the reminder_sent guard used to claim a send
        if "reminder_sent" in flt and target.get("reminder_sent") != flt["reminder_sent"]:
            return r
        r.matched_count = 1
        r.modified_count = 1
        target.update(update.get("$set", {}))
        return r


class FakeOrders:
    def __init__(self, phones_with_orders): self.phones = phones_with_orders
    async def find_one(self, query, projection=None):
        return {"_id": "x"} if query.get("phone") in self.phones else None


async def run_case(label, *, enabled, sessions, ordered_phones, expect_sent, expect_skipped):
    sent_calls: list[tuple] = []

    cfg = CS.get_settings()
    orig_enabled = cfg.CART_RECOVERY_ENABLED
    object.__setattr__(cfg, "CART_RECOVERY_ENABLED", enabled)

    fake_sessions = FakeSessions(sessions)
    CS.cart_sessions_col = lambda: fake_sessions          # type: ignore[assignment]
    CS.orders_col        = lambda: FakeOrders(ordered_phones)  # type: ignore[assignment]

    # Intercept the dispatch instead of sending anything.
    async def fake_to_thread(fn, *args):
        sent_calls.append(args)
    orig_to_thread = CS.asyncio.to_thread
    CS.asyncio.to_thread = fake_to_thread                 # type: ignore[assignment]

    try:
        summary = await CS.send_cart_recovery_reminders()
    finally:
        CS.asyncio.to_thread = orig_to_thread             # type: ignore[assignment]
        object.__setattr__(cfg, "CART_RECOVERY_ENABLED", orig_enabled)

    ok = summary["sent"] == expect_sent and summary["skipped_ordered"] == expect_skipped
    print(f"{'PASS' if ok else 'FAIL':4} {label}")
    print(f"       considered={summary['considered']} sent={summary['sent']} "
          f"skipped_ordered={summary['skipped_ordered']} dispatches={len(sent_calls)}")
    if not ok:
        print(f"       EXPECTED sent={expect_sent} skipped_ordered={expect_skipped}")
    assert ok, label
    return fake_sessions, sent_calls


def session(_id, phone, hours_ago, converted=False, reminder_sent=False):
    return {
        "_id": _id, "phone": phone,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=hours_ago),
        "converted": converted, "reminder_sent": reminder_sent,
        "items_summary": "3 articles — 87.50 MAD",
    }


async def main():
    print("=== cart recovery guard verification ===\n")

    # 1. Dry run: eligible cart, nothing sent, nothing marked.
    fs, calls = await run_case(
        "dry run sends nothing and marks nothing",
        enabled=False,
        sessions=[session("a", "0600000001", 3)],
        ordered_phones=set(), expect_sent=0, expect_skipped=0,
    )
    assert calls == [], "dry run dispatched a message"
    assert fs.docs[0]["reminder_sent"] is False, "dry run marked reminder_sent"
    print("       -> reminder_sent still False, no dispatch\n")

    # 2. Enabled: eligible cart gets exactly one message.
    fs, calls = await run_case(
        "enabled sends one message and marks it",
        enabled=True,
        sessions=[session("b", "0600000002", 3)],
        ordered_phones=set(), expect_sent=1, expect_skipped=0,
    )
    assert len(calls) == 1, calls
    assert fs.docs[0]["reminder_sent"] is True
    print("       -> one dispatch, reminder_sent=True\n")

    # 3. Too recent (inside the 2h delay) -> not considered.
    await run_case(
        "cart inside the delay window is not touched",
        enabled=True,
        sessions=[session("c", "0600000003", 1)],
        ordered_phones=set(), expect_sent=0, expect_skipped=0,
    )
    print()

    # 4. Too old (past max age) -> not considered.
    await run_case(
        "cart older than max age is skipped as stale",
        enabled=True,
        sessions=[session("d", "0600000004", 48)],
        ordered_phones=set(), expect_sent=0, expect_skipped=0,
    )
    print()

    # 5. Already converted -> excluded.
    await run_case(
        "converted session is never messaged",
        enabled=True,
        sessions=[session("e", "0600000005", 3, converted=True)],
        ordered_phones=set(), expect_sent=0, expect_skipped=0,
    )
    print()

    # 6. Already reminded -> one message ever.
    await run_case(
        "already-reminded session is never messaged twice",
        enabled=True,
        sessions=[session("f", "0600000006", 3, reminder_sent=True)],
        ordered_phones=set(), expect_sent=0, expect_skipped=0,
    )
    print()

    # 7. Ordered since, PATCH never arrived -> skipped and reconciled.
    fs, calls = await run_case(
        "customer who already ordered is skipped, not nagged",
        enabled=True,
        sessions=[session("g", "0600000007", 3)],
        ordered_phones={"0600000007"}, expect_sent=0, expect_skipped=1,
    )
    assert calls == [], "messaged a customer who had already ordered"
    assert fs.docs[0]["converted"] is True, "session not reconciled to converted"
    print("       -> no dispatch, session reconciled to converted\n")

    print("ALL CART RECOVERY GUARDS VERIFIED")


if __name__ == "__main__":
    asyncio.run(main())
