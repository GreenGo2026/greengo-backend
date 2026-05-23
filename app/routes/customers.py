from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import customers_col

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

@router.get("/{phone}", summary="Returning customer lookup by phone")
@limiter.limit("20/minute")
async def get_customer(phone: str, request: Request) -> dict:
    """
    Returns minimum checkout autofill data for a returning customer.
    Phone is the lookup key. Returns 404 if not found.
    Rate limited to prevent enumeration abuse.
    """
    normalized = _normalize_phone(phone)

    col = customers_col()
    doc = await col.find_one(
        {"phone": normalized},
        # Return only the fields needed for checkout — nothing else
        {
            "_id":          0,
            "name":         1,
            "last_address": 1,
            "total_points": 1,
            "orders":       1,
        }
    )

    if not doc:
        # Also try without normalization for legacy data
        doc = await col.find_one(
            {"phone": phone.strip()},
            {"_id": 0, "name": 1, "last_address": 1, "total_points": 1, "orders": 1}
        )

    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get last known address from orders if last_address not set
    last_address = doc.get("last_address", "")
    if not last_address and doc.get("orders"):
        # Fetch last order for address
        from app.database import orders_col
        from bson import ObjectId
        orders = doc.get("orders", [])
        if orders:
            last_order_id = orders[-1].get("order_id", "")
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

    return {
        "name":          doc.get("name", ""),
        "last_address":  last_address,
        "total_orders":  len(doc.get("orders", [])),
        "total_points":  doc.get("total_points", 0),
    }
