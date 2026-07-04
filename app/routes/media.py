# app/routes/media.py
from __future__ import annotations

import io
import os

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["Media"])

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
)

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/upload-image", summary="Upload product image", dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)) -> dict:
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Type non supporté: {file.content_type}. Utilisez JPG, PNG ou WebP.")

    contents = await file.read()
    if len(contents) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="Fichier trop grand (max 5 MB)")

    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(contents),
            folder="greengo/products",
            transformation=[{"width": 800, "height": 800, "crop": "limit"}],
            resource_type="image",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur upload Cloudinary: {exc}")

    # Same on-the-fly delivery transformation used by the rest of the catalog
    # (see scripts/upload_new_batch.py) -- keep it consistent across upload paths.
    url = result["secure_url"].replace("/upload/", "/upload/f_auto,q_auto/", 1)

    return {"url": url, "source": "cloudinary"}
