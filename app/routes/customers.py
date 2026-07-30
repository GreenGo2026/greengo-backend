from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth import require_admin
from app.database import customers_col, orders_col

router  = APIRouter(prefix="/api/v1/customers", tags=["Customers"])
limiter = Limiter(key_func=get_remote_address)

def _normalize_phone(phone: str) -> str:
    """Normalize to +212XXXXXXXXX format."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("0") and len(p) == 10:
        p = "+212" + p[1:]
    if not p.startswith("+"):
        p = "+212" + p
    return p

def _iso(v: Any) -> str:
    return v.isoformat() if isinstance(v, datetime) else str(v or "")

@router.get("", summary="List customers (admin CRM) — search, segment/zone filters")
async def list_customers(
    search:  str = Query(""),
    segment: str = Query(""),
    zone:    str = Query(""),
    limit:   int = Query(50, le=200),
    skip:    int = Query(0),
    _: None = Depends(require_admin),
) -> dict:
    col = customers_col()
    query: dict[str, Any] = {}

    if search:
        import re
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [{"name": pattern}, {"phone": pattern}]
    if segment:
        query["segment"] = segment
    if zone:
        query["zone"] = zone

    total = await col.count_documents(query)
    cursor = col.find(query).sort("total_spent", -1).skip(skip).limit(limit)

    customers = []
    async for c in cursor:
        customers.append({
            "id":             str(c["_id"]),
            "phone":          c.get("phone", ""),
            "name":           c.get("name", ""),
            "zone":           c.get("zone", ""),
            "total_orders":   c.get("total_orders", len(c.get("orders", []))),
            "total_spent":    round(c.get("total_spent", 0.0), 2),
            "last_order":     _iso(c.get("last_order")),
            "loyalty_points": c.get("total_points", 0),
            "segment":        c.get("segment", "new"),
        })

    return {
        "customers": customers,
        "total":     total,
        "segments": {
            "vip":     await col.count_documents({"segment": "vip"}),
            "regular": await col.count_documents({"segment": "regular"}),
            "new":     await col.count_documents({"segment": "new"}),
        },
    }

@router.get("/{phone}", summary="Returning customer lookup by phone (checkout autofill + admin CRM detail)")
@limiter.limit("20/minute")
async def get_customer(phone: str, request: Request, _: None = Depends(require_admin)) -> dict:
    """
    Dual-purpose: checkout autofill (CartPage.tsx / UserDashboard.tsx read
    name/last_address/total_orders/total_points -- those fields and their
    meaning are unchanged) and the admin CRM detail view (zone/segment/notes/
    order history, added below as new fields only). Phone is the lookup key.
    Returns 404 if not found. Rate limited to prevent enumeration abuse.
    """
    normalized = _normalize_phone(phone)

    col = customers_col()
    doc = await col.find_one({"phone": normalized})
    if not doc:
        # Also try without normalization for legacy data
        doc = await col.find_one({"phone": phone.strip()})
    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get last known address from orders if last_address not set
    last_address = doc.get("last_address", "")
    embedded_orders = doc.get("orders", [])
    if not last_address and embedded_orders:
        from app.database import orders_col
        from bson import ObjectId
        last_order_id = embedded_orders[-1].get("order_id", "")
        try:
            orders_c = orders_col()
            order = await orders_c.find_one(
                {"_id": ObjectId(last_order_id)},
                {"address": 1, "delivery_address": 1}
            )
            if order:
                last_address = order.get("address") or order.get("delivery_address", "")
        except Exception:
            pass

    # Detailed order history for the admin CRM view (status/zone/items_count) --
    # the embedded orders[] subdocument only has order_id/total_price/points/date.
    order_history: list[dict[str, Any]] = []
    try:
        from app.database import orders_col
        orders_c = orders_col()
        async for o in orders_c.find(
            {"phone": doc.get("phone", normalized)},
            {"_id": 1, "status": 1, "total_price": 1, "created_at": 1, "items": 1, "delivery_zone": 1},
        ).sort("created_at", -1).limit(20):
            order_history.append({
                "id":           str(o["_id"]),
                "status":       o.get("status"),
                "total":        o.get("total_price", 0),
                "date":         _iso(o.get("created_at")),
                "items_count":  len(o.get("items", [])),
                "zone":         o.get("delivery_zone", ""),
            })
    except Exception:
        pass

    return {
        # Unchanged -- existing checkout-autofill contract
        "name":          doc.get("name", ""),
        "last_address":  last_address,
        "total_orders":  doc.get("total_orders", len(embedded_orders)),
        "total_points":  doc.get("total_points", 0),
        # New -- admin CRM fields
        "phone":         doc.get("phone", normalized),
        "zone":          doc.get("zone", ""),
        "total_spent":   round(doc.get("total_spent", 0.0), 2),
        "loyalty_points": doc.get("total_points", 0),
        "segment":       doc.get("segment", "new"),
        "first_order":   _iso(doc.get("first_order")),
        "last_order":    _iso(doc.get("last_order")),
        "notes":         doc.get("notes", []),
        "orders":        order_history,
    }

@router.post("/{phone}/notes", summary="Add an admin note to a customer profile")
async def add_customer_note(
    phone: str,
    note: dict,
    request: Request,
    _: None = Depends(require_admin),
) -> dict:
    from app.services.audit import actor_id

    normalized = _normalize_phone(phone)
    col = customers_col()
    doc = await col.find_one({"phone": normalized}) or await col.find_one({"phone": phone.strip()})
    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")

    text = str(note.get("text", "")).strip()
    if not text:
        raise HTTPException(status_code=400, detail="Note text is required")

    note_entry = {
        "text":       text,
        "created_at": datetime.utcnow(),
        "admin":      actor_id(request),
    }
    await col.update_one({"_id": doc["_id"]}, {"$push": {"notes": note_entry}})
    return {"status": "note added"}


@router.post("/purge-invalid-phones", summary="ONE-TIME cleanup — DELETE AFTER USE")
async def purge_invalid_phone_customers(dry_run: bool = Query(True), _: None = Depends(require_admin)) -> dict:
    """
    Removes customer documents whose phone is not a plausible phone number
    (contains anything other than digits and a leading +) -- e.g. test/spam
    submissions like "+21200000000{1..3}" (unresolved bash brace expansion).
    A real Moroccan phone only ever contains digits and an optional leading
    '+', so this can't false-positive on a genuine customer the way a
    spend/order-count threshold could (a real customer's one big order would
    otherwise look identical to "spam" under a total_spent>=9000 heuristic).

    dry_run=true (default) only lists candidates, never deletes.
    """
    col = customers_col()
    invalid_filter = {"phone": {"$not": {"$regex": r"^\+?[0-9]+$"}}}

    candidates = []
    async for c in col.find(invalid_filter, {"phone": 1, "name": 1, "total_spent": 1, "total_orders": 1}):
        candidates.append({
            "id":           str(c["_id"]),
            "phone":        c.get("phone"),
            "name":         c.get("name"),
            "total_spent":  c.get("total_spent"),
            "total_orders": c.get("total_orders"),
        })

    # Report-only -- matching orders are never deleted here, an admin
    # decides separately whether those are worth removing.
    spam_orders = await orders_col().count_documents(invalid_filter)

    if dry_run:
        return {
            "dry_run":      True,
            "candidates":   candidates,
            "would_delete": len(candidates),
            "spam_orders_found_not_deleted": spam_orders,
        }

    result = await col.delete_many(invalid_filter)
    remaining = await col.count_documents({})
    return {
        "dry_run":         False,
        "deleted":         result.deleted_count,
        "deleted_records": candidates,
        "customers_after": remaining,
        "spam_orders_found_not_deleted": spam_orders,
        "action_required": "DELETE this endpoint after verifying results",
    }
