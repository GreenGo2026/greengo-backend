# app/routes/media.py
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["Media"])

_ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}
_MAX_BYTES     = 2 * 1024 * 1024  # 2 MB


def _upload_dir() -> Path:
    candidates = [
        Path("/app/assets/products"),
        Path(__file__).resolve().parent.parent.parent / "assets" / "products",
    ]
    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            return p
        except Exception:
            continue
    raise RuntimeError("Cannot create upload directory.")


@router.post("/upload-image", summary="Upload product image")
async def upload_image(
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
) -> dict:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez jpg, png ou webp.")

    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image trop grande — maximum 2 Mo.")

    filename = f"{uuid.uuid4().hex}.{ext}"
    try:
        dest = _upload_dir() / filename
        dest.write_bytes(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Échec de l'upload: {exc}")

    return {"url": f"/static/products/{filename}"}
