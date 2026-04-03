"""
Unified POI CRUD: /api/poi/{category}

Category values match PoiCategory (e.g. airbnb_listings, restaurants, hotel_listings).
"""

from __future__ import annotations

import math
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import require_editor
from app.core.database import get_pool
from app.models.municipality_user import MunicipalityUserRecord
from app.models.poi_generic import PoiCategory
from app.models.hotel_management import (
    HotelCreate,
    HotelRead,
    HotelUpdate,
    row_to_hotel_read,
)
from app.services.nominatim_geocoding import GeocodeNotFoundError, nominatim_geocoder
from app.services.poi_create import create_row_for_category
from app.services.poi_geospatial import resolve_stat_2022_for_point
from app.services.poi_table_registry import (
    PoiTableSpec,
    get_search_columns,
    get_spec,
    qualified_hotel_table,
)

router = APIRouter(prefix="/poi", tags=["poi"])


def _parse_category(category: str) -> PoiCategory:
    try:
        return PoiCategory(category)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category: {category!r}",
        ) from e


def _json_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (bytes, memoryview)):
        return None
    return v


def _json_row(r: asyncpg.Record, spec: PoiTableSpec) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in dict(r).items():
        if k == spec.geom_column or k == "embedding":
            continue
        out[k] = _json_value(v)
    return out


def _list_where_sql(spec: PoiTableSpec) -> tuple[str, str]:
    """Returns (WHERE clause fragment, ORDER BY column)."""
    if spec.semel_yish_column:
        return f'"{spec.semel_yish_column}" = $1', spec.name_column
    return (
        f'"{spec.stat_2022_column}" IN ('
        f"SELECT stat_2022 FROM public.statistical_areas WHERE semel_yish = $1"
        f")",
        spec.name_column,
    )


def _ilike_pattern(q: str) -> str:
    """Escape LIKE wildcards; wrap for ILIKE."""
    q = q.strip()
    if not q:
        return ""
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _search_and_clause(cat: PoiCategory) -> str:
    cols = get_search_columns(cat)
    parts = [f'COALESCE("{c}"::text, \'\') ILIKE $2' for c in cols]
    return f" AND ({' OR '.join(parts)})"


@router.get("/{category}")
async def list_poi(
    category: str,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: str | None = Query(
        None,
        max_length=200,
        description="Case-insensitive filter across main text columns (partial match)",
    ),
):
    cat = _parse_category(category)
    spec = get_spec(cat)
    where_sql, order_col = _list_where_sql(spec)
    pool = get_pool()
    pattern = _ilike_pattern(search or "")
    use_search = bool(pattern)
    where_full = f"{where_sql}{_search_and_clause(cat) if use_search else ''}"
    count_q = f"SELECT COUNT(*)::bigint AS c FROM {spec.sql_table} WHERE {where_full}"
    data_q = f"""
        SELECT * FROM {spec.sql_table}
        WHERE {where_full}
        ORDER BY "{order_col}" NULLS LAST
        LIMIT {'$3' if use_search else '$2'} OFFSET {'$4' if use_search else '$3'}
    """
    try:
        async with pool.acquire() as conn:
            if use_search:
                total_row = await conn.fetchrow(
                    count_q, current.semel_yish, pattern
                )
            else:
                total_row = await conn.fetchrow(count_q, current.semel_yish)
            total = int(total_row["c"]) if total_row else 0
            total_pages = math.ceil(total / page_size) if total > 0 else 0
            if total > 0:
                page = min(page, total_pages)
            else:
                page = 1
            offset = (page - 1) * page_size
            if use_search:
                rows = await conn.fetch(
                    data_q, current.semel_yish, pattern, page_size, offset
                )
            else:
                rows = await conn.fetch(
                    data_q, current.semel_yish, page_size, offset
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e
    return {
        "items": [_json_row(r, spec) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.delete("/{category}/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    category: str,
    entity_id: str,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    cat = _parse_category(category)
    spec = get_spec(cat)
    pool = get_pool()

    if spec.pk_column == "id":
        try:
            pk_val = UUID(entity_id) if len(entity_id) == 36 else entity_id
        except ValueError:
            pk_val = entity_id
    else:
        try:
            pk_val = UUID(entity_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid id") from None

    if spec.semel_yish_column:
        where_extra = f'AND "{spec.semel_yish_column}" = $2'
        params: list[Any] = [pk_val, current.semel_yish]
    else:
        where_extra = (
            f'AND "{spec.stat_2022_column}" IN ('
            f"SELECT stat_2022 FROM public.statistical_areas WHERE semel_yish = $2)"
        )
        params = [pk_val, current.semel_yish]

    sql = f"""
        DELETE FROM {spec.sql_table}
        WHERE "{spec.pk_column}" = $1 {where_extra}
    """
    try:
        async with pool.acquire() as conn:
            res = await conn.execute(sql, *params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e

    if res == "DELETE 0":
        raise HTTPException(status_code=404, detail="Record not found")
    return None


# --- POST / PATCH: hotel_listings delegates to same shape as hotels_management ---


@router.post(
    "/hotel_listings", response_model=HotelRead, status_code=status.HTTP_201_CREATED
)
async def create_hotel_listing_poi(
    body: HotelCreate,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    """Create row in public.hotels_listings (same logic as /hotels-management)."""
    ht = qualified_hotel_table()

    try:
        geo = await nominatim_geocoder.geocode_full_address(body.location_fulladdress)
    except GeocodeNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            stat_2022 = await resolve_stat_2022_for_point(
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
            detail="Insert failed: statistical area constraint.",
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e

    return row_to_hotel_read(row)


@router.patch("/hotel_listings/{hotel_uuid}", response_model=HotelRead)
async def update_hotel_listing_poi(
    hotel_uuid: UUID,
    body: HotelUpdate,
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    from app.api.endpoints.hotels_management import update_hotel

    return await update_hotel(hotel_uuid, body, current)


@router.post("/{category}", status_code=status.HTTP_201_CREATED)
async def create_poi_generic(
    category: str,
    body: dict[str, Any],
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    """Create POI row. hotel_listings uses dedicated POST /api/poi/hotel_listings with HotelCreate."""
    cat = _parse_category(category)
    if cat == PoiCategory.HOTEL_LISTINGS:
        raise HTTPException(
            status_code=400,
            detail="Use POST /api/poi/hotel_listings with HotelCreate JSON body.",
        )
    spec = get_spec(cat)
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await create_row_for_category(conn, cat, current.semel_yish, body)
    except HTTPException:
        raise
    except asyncpg.UniqueViolationError as e:
        raise HTTPException(
            status_code=409,
            detail="Insert failed: duplicate key.",
        ) from e
    except asyncpg.ForeignKeyViolationError as e:
        raise HTTPException(
            status_code=400,
            detail="Insert failed: statistical area or reference constraint.",
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e

    if row is None:
        raise HTTPException(status_code=500, detail="Insert returned no row.")
    return _json_row(row, spec)


@router.patch("/{category}/{entity_id}")
async def update_poi_generic(
    category: str,
    entity_id: str,
    body: dict[str, Any],
    current: Annotated[MunicipalityUserRecord, Depends(require_editor)],
):
    cat = _parse_category(category)
    if cat == PoiCategory.HOTEL_LISTINGS:
        raise HTTPException(
            status_code=400,
            detail="Use PATCH /api/poi/hotel_listings/{uuid} with HotelUpdate body.",
        )
    raise HTTPException(
        status_code=501,
        detail="Update for this category is not implemented yet.",
    )
