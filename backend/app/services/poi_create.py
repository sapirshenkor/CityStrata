"""INSERT helpers for /api/poi/{category} (excluding hotel_listings dedicated route)."""

from __future__ import annotations

from typing import Any

import asyncpg
from fastapi import HTTPException

from app.models.poi_generic import PoiCategory
from app.services.poi_geospatial import geocode_address_and_stat


def _str(body: dict[str, Any], key: str, *, required: bool = False) -> str | None:
    v = body.get(key)
    if v is None:
        if required:
            raise HTTPException(status_code=400, detail=f"Missing field: {key}")
        return None
    s = str(v).strip()
    if not s:
        if required:
            raise HTTPException(status_code=400, detail=f"Empty field: {key}")
        return None
    return s


def _opt_float(body: dict[str, Any], key: str) -> float | None:
    v = body.get(key)
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid number for {key}") from None


def _opt_int(body: dict[str, Any], key: str) -> int | None:
    v = body.get(key)
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid integer for {key}") from None


async def insert_airbnb(
    conn: asyncpg.Connection, semel_yish: int, body: dict[str, Any]
) -> asyncpg.Record:
    title = _str(body, "title", required=True)
    location_subtitle = _str(body, "location_subtitle", required=True)
    assert title is not None and location_subtitle is not None

    lat, lon, stat_2022 = await geocode_address_and_stat(conn, semel_yish, location_subtitle)

    next_row = await conn.fetchrow(
        "SELECT COALESCE(MAX(id), 0) + 1 AS n FROM public.airbnb_listings"
    )
    next_id = int(next_row["n"]) if next_row else 1

    url = _str(body, "url")
    description = _str(body, "description")
    num_nights = _opt_int(body, "num_nights")
    price_per_night = _opt_float(body, "price_per_night")
    rating_value = _opt_float(body, "rating_value")
    person_capacity = _opt_int(body, "person_capacity")

    return await conn.fetchrow(
        """
        INSERT INTO public.airbnb_listings (
            id, url, title, description,
            num_nights, price_per_night, rating_value, person_capacity,
            location_subtitle, coordinates_latitude, coordinates_longitude, location,
            semel_yish, stat_2022, imported_at
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, ST_SetSRID(ST_MakePoint($12, $13), 4326),
            $14, $15, NOW()
        )
        RETURNING *
        """,
        next_id,
        url,
        title,
        description,
        num_nights,
        price_per_night,
        rating_value,
        person_capacity,
        location_subtitle,
        lat,
        lon,
        lon,
        lat,
        semel_yish,
        stat_2022,
    )


def _jsonb_activity_times(body: dict[str, Any]) -> Any | None:
    """activity_times JSONB: object, array, or null. Rejects wrong types."""
    v = body.get("activity_times")
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    raise HTTPException(
        status_code=400,
        detail="activity_times must be a JSON object, array, or null.",
    )


async def insert_coffee_shop(
    conn: asyncpg.Connection, semel_yish: int, body: dict[str, Any]
) -> asyncpg.Record:
    title = _str(body, "title", required=True)
    street = _str(body, "street", required=True)
    assert title is not None and street is not None

    lat, lon, stat_2022 = await geocode_address_and_stat(conn, semel_yish, street)

    next_row = await conn.fetchrow(
        "SELECT COALESCE(MAX(cid), 0) + 1 AS n FROM public.coffee_shops"
    )
    next_cid = int(next_row["n"]) if next_row else 1

    description = _str(body, "description")
    category_name = _str(body, "category_name")
    total_score = _opt_float(body, "total_score")
    url = _str(body, "url")
    website = _str(body, "website")
    activity_times = _jsonb_activity_times(body)

    return await conn.fetchrow(
        """
        INSERT INTO public.coffee_shops (
            cid, title, description, category_name, total_score,
            url, website, street, activity_times,
            location_lat, location_lng, location,
            semel_yish, stat_2022, imported_at
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9::jsonb,
            $10, $11, ST_SetSRID(ST_MakePoint($12, $13), 4326),
            $14, $15, NOW()
        )
        RETURNING *
        """,
        next_cid,
        title,
        description,
        category_name,
        total_score,
        url,
        website,
        street,
        activity_times,
        lat,
        lon,
        lon,
        lat,
        semel_yish,
        stat_2022,
    )


async def insert_restaurant(
    conn: asyncpg.Connection, semel_yish: int, body: dict[str, Any]
) -> asyncpg.Record:
    title = _str(body, "title", required=True)
    street = _str(body, "street", required=True)
    assert title is not None and street is not None

    lat, lon, stat_2022 = await geocode_address_and_stat(conn, semel_yish, street)

    next_row = await conn.fetchrow(
        "SELECT COALESCE(MAX(cid)::numeric, 0) + 1 AS n FROM public.restaurants"
    )
    next_cid = next_row["n"] if next_row else 1

    description = _str(body, "description")
    category_name = _str(body, "category_name")
    total_score = _opt_float(body, "total_score")
    url = _str(body, "url")
    website = _str(body, "website")

    return await conn.fetchrow(
        """
        INSERT INTO public.restaurants (
            cid, title, description, category_name, total_score,
            url, website, street,
            location_lat, location_lng, location,
            semel_yish, stat_2022, imported_at
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, ST_SetSRID(ST_MakePoint($11, $12), 4326),
            $13, $14, NOW()
        )
        RETURNING *
        """,
        next_cid,
        title,
        description,
        category_name,
        total_score,
        url,
        website,
        street,
        lat,
        lon,
        lon,
        lat,
        semel_yish,
        stat_2022,
    )


async def insert_matnas(
    conn: asyncpg.Connection, semel_yish: int, body: dict[str, Any]
) -> asyncpg.Record:
    matnas_name = _str(body, "matnas_name", required=True)
    full_address = _str(body, "full_address", required=True)
    person_in_charge = _str(body, "person_in_charge")
    phone_number = _str(body, "phone_number")
    activity_days = _str(body, "activity_days")
    facility_area = _opt_int(body, "facility_area")
    occupancy = _opt_int(body, "occupancy")
    number_of_activity_rooms = _str(body, "number_of_activity_rooms")
    shelter_and_where = _str(body, "shelter_and_where")
    assert matnas_name is not None and full_address is not None

    lat, lon, stat_2022 = await geocode_address_and_stat(conn, semel_yish, full_address)

    try:
        return await conn.fetchrow(
            """
            INSERT INTO public.matnasim (
                matnas_name, full_address,
                person_in_charge, phone_number, activity_days,
                facility_area, occupancy, number_of_activity_rooms, shelter_and_where,
                location_lat, location_lng, location,
                semel_yish, stat_2022, imported_at
            )
            VALUES (
                $1, $2,
                $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, ST_SetSRID(ST_MakePoint($12, $13), 4326),
                $14, $15, NOW()
            )
            RETURNING *
            """,
            matnas_name,
            full_address,
            person_in_charge,
            phone_number,
            activity_days,
            facility_area,
            occupancy,
            number_of_activity_rooms,
            shelter_and_where,
            lat,
            lon,
            lon,
            lat,
            semel_yish,
            stat_2022,
        )
    except asyncpg.UniqueViolationError as e:
        raise HTTPException(
            status_code=409,
            detail="A matnas with this name already exists.",
        ) from e


async def insert_educational_institution(
    conn: asyncpg.Connection, semel_yish: int, body: dict[str, Any]
) -> asyncpg.Record:
    institution_code = _str(body, "institution_code", required=True)
    institution_name = _str(body, "institution_name", required=True)
    full_address = _str(body, "full_address", required=True)
    type_of_supervision = _str(body, "type_of_supervision")
    type_of_education = _str(body, "type_of_education")
    education_phase = _str(body, "education_phase")
    assert institution_code is not None and institution_name is not None and full_address is not None

    lat, lon, stat_2022 = await geocode_address_and_stat(conn, semel_yish, full_address)

    try:
        return await conn.fetchrow(
            """
            INSERT INTO public.educational_institutions (
                institution_code, institution_name,
                address, full_address,
                type_of_supervision, type_of_education, education_phase,
                lat, lon, location, stat_2022, imported_at
            )
            VALUES (
                $1, $2,
                NULL, $3,
                $4, $5, $6,
                $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326), $11, NOW()
            )
            RETURNING *
            """,
            institution_code,
            institution_name,
            full_address,
            type_of_supervision,
            type_of_education,
            education_phase,
            lat,
            lon,
            lon,
            lat,
            stat_2022,
        )
    except asyncpg.UniqueViolationError as e:
        raise HTTPException(
            status_code=409,
            detail="An institution with this code already exists.",
        ) from e


async def insert_synagogue(
    conn: asyncpg.Connection, semel_yish: int, body: dict[str, Any]
) -> asyncpg.Record:
    name = _str(body, "name")
    name_he = _str(body, "name_he")
    if not name and not name_he:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of name or name_he.",
        )

    syn_type = _str(body, "type")
    type_he = _str(body, "type_he")
    if not syn_type and not type_he:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of type or type_he.",
        )

    address = _str(body, "address", required=True)
    assert address is not None

    # DB columns name/type are NOT NULL; allow Hebrew-only input by storing the
    # fallback language in the primary column as well.
    name_db = name or name_he
    name_he_db = name_he
    type_db = syn_type or type_he
    type_he_db = type_he

    lat, lon, stat_2022 = await geocode_address_and_stat(conn, semel_yish, address)

    return await conn.fetchrow(
        """
        INSERT INTO public.synagogues (
            name, name_he, type, type_he, address,
            location_lat, location_lng, location,
            semel_yish, stat_2022
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326),
            $10, $11
        )
        RETURNING *
        """,
        name_db,
        name_he_db,
        type_db,
        type_he_db,
        address,
        lat,
        lon,
        lon,
        lat,
        semel_yish,
        stat_2022,
    )


async def create_row_for_category(
    conn: asyncpg.Connection,
    category: PoiCategory,
    semel_yish: int,
    body: dict[str, Any],
) -> asyncpg.Record:
    if category == PoiCategory.AIRBNB_LISTINGS:
        return await insert_airbnb(conn, semel_yish, body)
    if category == PoiCategory.COFFEE_SHOPS:
        return await insert_coffee_shop(conn, semel_yish, body)
    if category == PoiCategory.RESTAURANTS:
        return await insert_restaurant(conn, semel_yish, body)
    if category == PoiCategory.MATNASIM:
        return await insert_matnas(conn, semel_yish, body)
    if category == PoiCategory.EDUCATIONAL_INSTITUTIONS:
        return await insert_educational_institution(conn, semel_yish, body)
    if category == PoiCategory.SYNAGOGUES:
        return await insert_synagogue(conn, semel_yish, body)
    raise HTTPException(
        status_code=501,
        detail="Create for this category is not implemented.",
    )
