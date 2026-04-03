"""Shared geocoding + statistical area resolution for POI inserts."""

from __future__ import annotations

import asyncpg
from fastapi import HTTPException

from app.services.nominatim_geocoding import GeocodeNotFoundError, nominatim_geocoder


async def resolve_stat_2022_for_point(
    conn: asyncpg.Connection, semel_yish: int, lon: float, lat: float
) -> int:
    row = await conn.fetchrow(
        """
        SELECT sa.stat_2022
        FROM public.statistical_areas sa
        WHERE sa.semel_yish = $1
          AND ST_Contains(sa.geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))
        ORDER BY sa.stat_2022
        LIMIT 1
        """,
        semel_yish,
        lon,
        lat,
    )
    if row is None:
        raise HTTPException(
            status_code=400,
            detail="Geocoded location is outside known statistical areas for this municipality.",
        )
    return int(row["stat_2022"])


async def geocode_address_and_stat(
    conn: asyncpg.Connection,
    semel_yish: int,
    address: str,
) -> tuple[float, float, int]:
    """Returns (lat, lon, stat_2022)."""
    q = (address or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Address is required for geocoding.")
    try:
        geo = await nominatim_geocoder.geocode_full_address(q)
    except GeocodeNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    stat_2022 = await resolve_stat_2022_for_point(
        conn, semel_yish, geo.longitude, geo.latitude
    )
    return geo.latitude, geo.longitude, stat_2022
