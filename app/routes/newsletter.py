# app/routes/newsletter.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from app.database import newsletter_col

router = APIRouter(prefix="/api/v1/newsletter", tags=["Newsletter"])


class NewsletterSubscribe(BaseModel):
    email: EmailStr
    source: str = "website"


@router.post("", status_code=201, summary="Subscribe an email to the newsletter")
async def subscribe(payload: NewsletterSubscribe) -> dict[str, Any]:
    col = newsletter_col()
    email = payload.email.lower().strip()

    existing = await col.find_one({"email": email})
    if existing:
        return {"status": "already_subscribed"}

    await col.insert_one({
        "email":      email,
        "source":     payload.source,
        "created_at": datetime.now(tz=timezone.utc),
        "active":     True,
    })
    return {"status": "subscribed"}
