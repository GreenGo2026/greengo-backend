"""
Dev/test data reset -- admin-gated, side-effect-free.

Direct DB writes only: never fires WhatsApp/Green-API, never restocks, never
touches customer notifications. Every write is stamped changed_by="dev_reset".

Double-gated: require_admin AND ENABLE_DEV_RESET=true in the environment.
Leave ENABLE_DEV_RESET unset/false in production unless actively testing.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin
from app.database import drivers_col, orders_col

router = APIRouter(prefix="/api/v1/admin/dev", tags=["Dev - Reset"])

_TEST_NAME_REGEX = r"test|spam|\brl\d|probe|e2e|matrix|mock"
_TEST_PHONES = ["+212612345678", "0612345678", "+212699900111", "0600000000", "0677889900"]


def _require_dev_reset() -> None:
    if os.environ.get("ENABLE_DEV_RESET", "false").strip().lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="Dev reset endpoints are disabled. Set ENABLE_DEV_RESET=true.",
        )


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid ObjectId: {v}")


class OrderResetPayload(BaseModel):
    order_id: str
    to_status: Literal[
        "Pending", "Confirmed", "Assigned", "Preparing", "Ready",
        "Out for Delivery", "Pending Confirmation", "Delivered", "Completed", "Cancelled",
    ] = "Pending"
    clear_driver: bool = True


class DriverResetPayload(BaseModel):
    driver_id: str
    deactivate: bool = True
    reset_earnings: bool = False


@router.post("/reset-order", summary="[DEV] Reset an order's status directly -- no WhatsApp")
async def dev_reset_order(
    payload: OrderResetPayload,
    _guard: None = Depends(_require_dev_reset),
    _admin: None = Depends(require_admin),
) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    update: dict[str, Any] = {"status": payload.to_status, "updated_at": now}
    if payload.clear_driver:
        update.update({
            "assigned_livreur_id":   None,
            "assigned_livreur_name": "",
            "driver_name":           "",
            "driver_phone":          "",
            "assigned_at":           None,
            "ready_at":              None,
            "delivering_at":         None,
            "delivered_at":          None,
        })

    result = await orders_col().find_one_and_update(
        {"_id": _oid(payload.order_id)},
        {
            "$set": update,
            "$push": {"status_history": {
                "from": None, "to": payload.to_status, "timestamp": now,
                "changed_by": "dev_reset", "note": "Direct reset -- no WhatsApp fired",
            }},
        },
        return_document=True,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Order {payload.order_id} not found.")
    return {
        "reset": True,
        "order_id": payload.order_id,
        "new_status": payload.to_status,
        "whatsapp_fired": False,
    }


@router.post("/reset-driver", summary="[DEV] Deactivate a driver and optionally wipe earnings")
async def dev_reset_driver(
    payload: DriverResetPayload,
    _guard: None = Depends(_require_dev_reset),
    _admin: None = Depends(require_admin),
) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    update: dict[str, Any] = {"updated_at": now}
    if payload.deactivate:
        update.update({"active": False, "status": "rejected"})
    if payload.reset_earnings:
        update.update({"total_earnings": 0.0, "daily_earnings": []})

    result = await drivers_col().find_one_and_update(
        {"_id": _oid(payload.driver_id)},
        {"$set": update},
        return_document=True,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Driver {payload.driver_id} not found.")
    return {
        "reset": True,
        "driver_id": payload.driver_id,
        "deactivated": payload.deactivate,
        "earnings_wiped": payload.reset_earnings,
    }


@router.get("/list-test-data", summary="[DEV] List orders/drivers matching test-data patterns")
async def dev_list_test_data(
    _guard: None = Depends(_require_dev_reset),
    _admin: None = Depends(require_admin),
) -> dict[str, Any]:
    test_orders = await orders_col().find({
        "$or": [
            {"customer_name": {"$regex": _TEST_NAME_REGEX, "$options": "i"}},
            {"phone": {"$in": _TEST_PHONES}},
        ]
    }).sort("created_at", -1).limit(50).to_list(length=50)

    test_drivers = await drivers_col().find(
        {"name": {"$regex": _TEST_NAME_REGEX, "$options": "i"}}
    ).sort("created_at", -1).to_list(length=50)

    return {
        "test_orders": [
            {"id": str(d["_id"]), "customer": d.get("customer_name"),
             "status": d.get("status"), "phone": d.get("phone")}
            for d in test_orders
        ],
        "test_drivers": [
            {"id": str(d["_id"]), "name": d.get("name"),
             "status": d.get("status"), "active": d.get("active")}
            for d in test_drivers
        ],
    }
