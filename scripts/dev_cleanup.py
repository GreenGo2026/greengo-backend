#!/usr/bin/env python3
"""
GreenGo -- Dev/Test Data Cleanup Script
Operates DIRECTLY on MongoDB (bypasses the API and all its side effects).
Never fires WhatsApp, never triggers restock, never touches customer notifications.

Usage:
  python scripts/dev_cleanup.py --list-test-orders
  python scripts/dev_cleanup.py --cancel-order <order_id>
  python scripts/dev_cleanup.py --reset-order <order_id> --to pending
  python scripts/dev_cleanup.py --list-test-drivers
  python scripts/dev_cleanup.py --deactivate-driver <driver_id>
  python scripts/dev_cleanup.py --reset-driver-earnings <driver_id>

Add --yes to skip the interactive confirmation (for scripted teardown).

WARNING: the local .env points MONGODB_URI at the SAME Atlas cluster Railway
uses, so APP_ENV is not a reliable "am I on prod" signal. This script always
shows the cluster host and asks for confirmation unless --yes is passed.
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

import pymongo
from bson import ObjectId
from bson.errors import InvalidId

MONGO_URI = os.environ.get("MONGODB_URI", "")
DB_NAME   = os.environ.get("MONGO_DB_NAME", "greengo_db")
APP_ENV   = os.environ.get("APP_ENV", "unknown")

if not MONGO_URI:
    print("ERROR: MONGODB_URI not set in .env")
    sys.exit(1)

client  = pymongo.MongoClient(MONGO_URI)
db      = client[DB_NAME]
orders  = db["orders"]
drivers = db["drivers"]

_VALID_STATUSES = [
    "Pending", "Confirmed", "Assigned", "Preparing", "Ready",
    "Out for Delivery", "Pending Confirmation", "Delivered", "Completed", "Cancelled",
]

_TEST_ORDER_PHONES = {
    "0612345678", "+212612345678", "0699900111", "0699900222",
    "0600000000", "0677889900",
}
_TEST_NAME_REGEX = r"test|matrix|e2e|spam|\brl\d|probe"


def _host() -> str:
    try:
        return client.address[0] if client.address else MONGO_URI.split("@")[-1].split("/")[0]
    except Exception:
        return "unknown"


def confirm(skip: bool) -> None:
    print(f"\n  DB:      {DB_NAME}")
    print(f"  Cluster: {_host()}")
    print(f"  APP_ENV: {APP_ENV}")
    if skip:
        return
    ans = input("\n  Proceed against this database? Type 'yes': ").strip().lower()
    if ans != "yes":
        print("  Aborted.")
        sys.exit(0)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        print(f"Invalid ObjectId: {v}")
        sys.exit(1)


def _fmt_dt(v) -> str:
    return v.strftime("%Y-%m-%d") if isinstance(v, datetime) else str(v or "")


def list_test_orders() -> None:
    cur = orders.find({
        "$or": [
            {"phone": {"$in": list(_TEST_ORDER_PHONES)}},
            {"customer_name": {"$regex": _TEST_NAME_REGEX, "$options": "i"}},
        ]
    }).sort("created_at", -1).limit(50)
    rows = list(cur)
    if not rows:
        print("No test orders found.")
        return
    print(f"\n{'ID':<26} {'Status':<22} {'Customer':<18} {'Phone':<16} Date")
    print("-" * 96)
    for o in rows:
        print(f"{str(o['_id']):<26} {str(o.get('status','')):<22} "
              f"{str(o.get('customer_name',''))[:17]:<18} {str(o.get('phone',''))[:15]:<16} "
              f"{_fmt_dt(o.get('created_at'))}")
    print(f"\n{len(rows)} order(s).")


def cancel_order(order_id: str) -> None:
    now = datetime.now(tz=timezone.utc)
    res = orders.update_one(
        {"_id": _oid(order_id)},
        {"$set": {"status": "Cancelled", "updated_at": now},
         "$push": {"status_history": {
             "from": None, "to": "Cancelled", "timestamp": now,
             "changed_by": "dev_cleanup_script",
             "note": "Direct DB cancel -- no WhatsApp fired",
         }}},
    )
    print(f"Order {order_id} not found." if res.matched_count == 0
          else f"OK  Order {order_id} -> Cancelled (no WhatsApp, no restock)")


def reset_order(order_id: str, to_status: str) -> None:
    normalised = next((s for s in _VALID_STATUSES if s.lower() == to_status.lower()), None)
    if not normalised:
        print(f"Invalid status '{to_status}'. Valid: {_VALID_STATUSES}")
        sys.exit(1)
    now = datetime.now(tz=timezone.utc)
    res = orders.update_one(
        {"_id": _oid(order_id)},
        {"$set": {
            "status": normalised, "updated_at": now,
            "assigned_livreur_id": None, "assigned_livreur_name": "",
            "assigned_at": None, "ready_at": None,
            "delivering_at": None, "delivered_at": None,
         },
         "$push": {"status_history": {
             "from": None, "to": normalised, "timestamp": now,
             "changed_by": "dev_cleanup_script",
             "note": f"Direct DB reset to {normalised} -- no WhatsApp fired",
         }}},
    )
    print(f"Order {order_id} not found." if res.matched_count == 0
          else f"OK  Order {order_id} -> {normalised} (direct DB)")


def list_test_drivers() -> None:
    cur = drivers.find({"name": {"$regex": r"e2e|test|\brl\d|spam|probe", "$options": "i"}}
                       ).sort("created_at", -1)
    rows = list(cur)
    if not rows:
        print("No test drivers found.")
        return
    print(f"\n{'ID':<26} {'Name':<20} {'Status':<12} Active")
    print("-" * 66)
    for d in rows:
        print(f"{str(d['_id']):<26} {str(d.get('name',''))[:19]:<20} "
              f"{str(d.get('status','')):<12} {d.get('active', False)}")
    print(f"\n{len(rows)} driver(s).")


def deactivate_driver(driver_id: str) -> None:
    now = datetime.now(tz=timezone.utc)
    res = drivers.update_one(
        {"_id": _oid(driver_id)},
        {"$set": {"active": False, "status": "rejected", "updated_at": now}},
    )
    print(f"Driver {driver_id} not found." if res.matched_count == 0
          else f"OK  Driver {driver_id} -> deactivated/rejected")


def reset_driver_earnings(driver_id: str) -> None:
    res = drivers.update_one(
        {"_id": _oid(driver_id)},
        {"$set": {"total_earnings": 0.0, "daily_earnings": []}},
    )
    print(f"Driver {driver_id} not found." if res.matched_count == 0
          else f"OK  Driver {driver_id} earnings reset to 0")


def main() -> None:
    p = argparse.ArgumentParser(description="GreenGo dev/test data cleanup (no WhatsApp side effects)")
    p.add_argument("--list-test-orders",      action="store_true")
    p.add_argument("--cancel-order",          metavar="ORDER_ID")
    p.add_argument("--reset-order",           metavar="ORDER_ID")
    p.add_argument("--to",                    metavar="STATUS", default="pending")
    p.add_argument("--list-test-drivers",     action="store_true")
    p.add_argument("--deactivate-driver",     metavar="DRIVER_ID")
    p.add_argument("--reset-driver-earnings", metavar="DRIVER_ID")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = p.parse_args()

    read_only = args.list_test_orders or args.list_test_drivers
    if not any([args.list_test_orders, args.cancel_order, args.reset_order,
                args.list_test_drivers, args.deactivate_driver, args.reset_driver_earnings]):
        p.print_help()
        return

    confirm(skip=args.yes or read_only)

    if   args.list_test_orders:       list_test_orders()
    elif args.cancel_order:           cancel_order(args.cancel_order)
    elif args.reset_order:            reset_order(args.reset_order, args.to)
    elif args.list_test_drivers:      list_test_drivers()
    elif args.deactivate_driver:      deactivate_driver(args.deactivate_driver)
    elif args.reset_driver_earnings:  reset_driver_earnings(args.reset_driver_earnings)


if __name__ == "__main__":
    main()
