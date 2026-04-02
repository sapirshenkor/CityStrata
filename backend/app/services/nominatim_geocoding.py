"""
Geocode addresses via Nominatim (OpenStreetMap).

Respects the public usage policy: one request per second and a descriptive User-Agent.
"""

from __future__ import annotations

import asyncio
import time
from typing import NamedTuple

import httpx

from app.core.config import settings


class GeocodeResult(NamedTuple):
    latitude: float
    longitude: float
    display_name: str | None


class GeocodeNotFoundError(Exception):
    """No Nominatim results for the given query."""


class NominatimGeocoder:
    """Async Nominatim client with a 1-second throttle (async lock) between calls."""

    BASE_URL = "https://nominatim.openstreetmap.org/search"

    def __init__(self, user_agent: str | None = None) -> None:
        self._user_agent = user_agent or settings.nominatim_user_agent
        self._lock = asyncio.Lock()
        self._next_allowed_monotonic = 0.0

    async def geocode_full_address(self, address: str) -> GeocodeResult:
        """
        Forward geocode a free-text address to WGS84 lat/lng.
        """
        q = (address or "").strip()
        if not q:
            raise GeocodeNotFoundError("Empty address")

        params = {
            "q": q,
            "format": "json",
            "limit": 1,
            "addressdetails": 0,
        }
        headers = {
            "User-Agent": self._user_agent,
            "Accept-Language": "en",
        }

        async with self._lock:
            now = time.monotonic()
            wait = self._next_allowed_monotonic - now
            if wait > 0:
                await asyncio.sleep(wait)
            self._next_allowed_monotonic = time.monotonic() + 1.0

            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(self.BASE_URL, params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json()

        if not data:
            raise GeocodeNotFoundError(f"No results for: {q!r}")

        first = data[0]
        lat = float(first["lat"])
        lon = float(first["lon"])
        display = first.get("display_name")
        return GeocodeResult(latitude=lat, longitude=lon, display_name=display)


nominatim_geocoder = NominatimGeocoder()
