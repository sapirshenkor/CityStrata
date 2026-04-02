"""
Hotel management JSON API (CRUD).

Uses public.hotels_listings (see poi_table_registry.qualified_hotel_table).

Routes are mounted at /api/hotels-management so they do not conflict with the existing
GET /api/hotels GeoJSON map layer.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg

from app.core.auth import require_editor
from app.core.database import get_pool
from app.models.hotel_management import (
    HotelCreate,
    HotelRead,
    HotelUpdate,
    row_to_hotel_read,
)
from app.models.municipality_user import MunicipalityUserRecord
from app.services.nominatim_geocoding import GeocodeNotFoundError, nominatim_geocoder
from app.services.poi_table_registry import qualified_hotel_table

router = APIRouter(prefix="/hotels-management", tags=["hotels-management"])


def _hotels_from_clause() -> str:
    return qualified_hotel_table()


async def _resolve_stat_2022(
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


async def _fetch_hotel_for_user(
    conn: asyncpg.Connection, hotel_uuid: UUID, semel_yish: int
) -> asyncpg.Record:
    ht = _hotels_from_clause()
    row = await conn.fetchrow(
        f"""
        SELECT uuid, hotelid, url, name, description, type, rating_value,
               location_fulladdress, coordinates_latitude, coordinates_longitude,
               semel_yish, stat_2022, imported_at
        FROM {ht}
        WHERE uuid = $1 AND semel_yish = $2
        """,
        hotel_uuid,
        semel_yish,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return row


@router.get("", response_model=list[HotelRead])
async def list_hotels(
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    """List hotels scoped to the signed-in user's semel_yish."""
    pool = get_pool()
    ht = _hotels_from_clause()
    query = f"""
        SELECT uuid, hotelid, url, name, description, type, rating_value,
               location_fulladdress, coordinates_latitude, coordinates_longitude,
               semel_yish, stat_2022, imported_at
        FROM {ht}
        WHERE semel_yish = $1
        ORDER BY name NULLS LAST
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, current.semel_yish)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e
    return [row_to_hotel_read(r) for r in rows]


@router.post("", response_model=HotelRead, status_code=status.HTTP_201_CREATED)
async def create_hotel(
    body: HotelCreate,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    """Create a hotel: geocode address, derive stat_2022 from geometry, insert."""
    try:
        geo = await nominatim_geocoder.geocode_full_address(body.location_fulladdress)
    except GeocodeNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    pool = get_pool()
    ht = _hotels_from_clause()

    try:
        async with pool.acquire() as conn:
            stat_2022 = await _resolve_stat_2022(
                conn, current.semel_yish, geo.longitude, geo.latitude
            )

            next_id_row = await conn.fetchrow(
                f"SELECT COALESCE(MAX(hotelid), 0) + 1 AS n FROM {ht}"
            )
            next_hotelid = int(next_id_row["n"])

            row = await conn.fetchrow(
                f"""
                INSERT INTO {ht} (
                    hotelid, url, name, description, type, rating_value,
                    location_fulladdress, coordinates_latitude, coordinates_longitude, location,
                    semel_yish, stat_2022, imported_at
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, ST_SetSRID(ST_MakePoint($10, $11), 4326),
                    $12, $13, NOW()
                )
                RETURNING uuid, hotelid, url, name, description, type, rating_value,
                          location_fulladdress, coordinates_latitude, coordinates_longitude,
                          semel_yish, stat_2022, imported_at
                """,
                next_hotelid,
                body.url,
                body.name,
                body.description,
                body.type,
                body.rating_value,
                body.location_fulladdress.strip(),
                geo.latitude,
                geo.longitude,
                geo.longitude,
                geo.latitude,
                current.semel_yish,
                stat_2022,
            )
    except asyncpg.ForeignKeyViolationError as e:
        raise HTTPException(
            status_code=400,
            detail="Insert failed: statistical area constraint — check semel_yish/stat_2022.",
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e

    return row_to_hotel_read(row)


@router.patch("/{hotel_uuid}", response_model=HotelRead)
async def update_hotel(
    hotel_uuid: UUID,
    body: HotelUpdate,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    """Update hotel fields; re-geocode when location_fulladdress changes."""
    pool = get_pool()
    ht = _hotels_from_clause()

    async with pool.acquire() as conn:
        existing = await _fetch_hotel_for_user(conn, hotel_uuid, current.semel_yish)

        updates = body.model_dump(exclude_unset=True)
        if not updates:
            return row_to_hotel_read(existing)

        new_lat = float(existing["coordinates_latitude"])
        new_lon = float(existing["coordinates_longitude"])
        new_stat = int(existing["stat_2022"])
        new_address = existing["location_fulladdress"]

        address_changed = False
        if "location_fulladdress" in updates:
            raw = updates["location_fulladdress"]
            if raw is None or not str(raw).strip():
                raise HTTPException(
                    status_code=400,
                    detail="location_fulladdress cannot be empty",
                )
            if str(raw).strip() != (existing["location_fulladdress"] or "").strip():
                address_changed = True
                try:
                    geo = await nominatim_geocoder.geocode_full_address(str(raw))
                except GeocodeNotFoundError as e:
                    raise HTTPException(status_code=400, detail=str(e)) from e
                new_lat = geo.latitude
                new_lon = geo.longitude
                new_stat = await _resolve_stat_2022(
                    conn, current.semel_yish, new_lon, new_lat
                )
                new_address = str(raw).strip()

        set_parts: list[str] = []
        args: list[object] = []

        def add_arg(value: object) -> str:
            args.append(value)
            return f"${len(args)}"

        field_map = {
            "name": "name",
            "type": "type",
            "description": "description",
            "url": "url",
            "rating_value": "rating_value",
        }
        for key, col in field_map.items():
            if key in updates:
                set_parts.append(f"{col} = {add_arg(updates[key])}")

        if address_changed:
            set_parts.append(f"location_fulladdress = {add_arg(new_address)}")
            set_parts.append(f"coordinates_latitude = {add_arg(new_lat)}")
            set_parts.append(f"coordinates_longitude = {add_arg(new_lon)}")
            plon = add_arg(new_lon)
            plat = add_arg(new_lat)
            set_parts.append(
                f"location = ST_SetSRID(ST_MakePoint({plon}, {plat}), 4326)"
            )
            set_parts.append(f"stat_2022 = {add_arg(new_stat)}")

        if not set_parts:
            return row_to_hotel_read(existing)

        set_sql = ", ".join(set_parts)
        args.extend([hotel_uuid, current.semel_yish])
        p_uuid = len(args) - 1
        p_semel = len(args)

        try:
            row = await conn.fetchrow(
                f"""
                UPDATE {ht}
                SET {set_sql}
                WHERE uuid = ${p_uuid} AND semel_yish = ${p_semel}
                RETURNING uuid, hotelid, url, name, description, type, rating_value,
                          location_fulladdress, coordinates_latitude, coordinates_longitude,
                          semel_yish, stat_2022, imported_at
                """,
                *args,
            )
        except asyncpg.ForeignKeyViolationError as e:
            raise HTTPException(
                status_code=400,
                detail="Update failed: statistical area constraint.",
            ) from e

        if row is None:
            raise HTTPException(status_code=404, detail="Hotel not found")

    return row_to_hotel_read(row)


@router.delete("/{hotel_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hotel(
    hotel_uuid: UUID,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    """Delete a hotel row within the user's semel_yish."""
    pool = get_pool()
    ht = _hotels_from_clause()
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                f"DELETE FROM {ht} WHERE uuid = $1 AND semel_yish = $2",
                hotel_uuid,
                current.semel_yish,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Hotel not found")
    return None
