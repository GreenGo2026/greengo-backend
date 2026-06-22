from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter(prefix="/api/v1", tags=["Geocode"])

@router.get("/geocode", summary="Reverse geocode lat/lng to address")
async def reverse_geocode(lat: float, lng: float) -> dict:
    """
    Proxy for Nominatim reverse geocoding.
    Swap this backend for Google Maps / Pelias at scale without frontend changes.
    """
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat":            lat,
        "lon":            lng,
        "format":         "json",
        "accept-language": "fr",
        "zoom":           16,
        "addressdetails": 1,
    }
    headers = {
        "User-Agent": "GreenGoMarket/1.0 (contact@mygreengoo.com)"
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
    except Exception:
        raise HTTPException(status_code=503, detail="Geocoding service temporarily unavailable.")

    addr = data.get("address", {})
    # Build a clean Moroccan delivery address
    parts = []
    for key in ["road", "suburb", "quarter", "neighbourhood", "city_district", "city", "town"]:
        val = addr.get(key, "").strip()
        if val and val not in parts:
            parts.append(val)

    display = data.get("display_name", "")
    short   = ", ".join(parts[:4]) if parts else display.split(",")[0]

    return {
        "display":  short,
        "full":     display,
        "city":     addr.get("city") or addr.get("town") or addr.get("village", ""),
        "district": addr.get("suburb") or addr.get("quarter", ""),
        "road":     addr.get("road", ""),
        "lat":      lat,
        "lng":      lng,
    }
