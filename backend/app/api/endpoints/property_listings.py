from __future__ import annotations

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status
from geopy.exc import GeocoderServiceError, GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim

from app.core.auth import get_current_user
from app.core.database import get_pool
from app.models.municipality_user import MunicipalityUserRecord
from app.models.property_listing import (
    PropertyListingCreate,
    PropertyListingRead,
    PropertyListingUnitCreate,
    PropertyListingUnitRead,
    PropertyListingUpdate,
    PropertyType,
)

router = APIRouter(prefix="/property-listings", tags=["property-listings"])
_geolocator = Nominatim(user_agent="citystrata_geocoder")
_GEOCODE_ERROR_DETAIL = (
    "Could not resolve address to coordinates. Please provide coordinates or check the address."
)

_LISTING_SELECT = """
    pl.id, pl.municipality_user_id, pl.property_type, pl.property_type_other,
    pl.city, pl.street, pl.house_number, pl.neighborhood,
    pl.total_floors, pl.parking_spots,
    ST_Y(pl.location::geometry) AS latitude,
    ST_X(pl.location::geometry) AS longitude,
    pl.publisher_name, pl.phone_number,
    pl.created_at, pl.updated_at
""".replace("\n", " ").strip()

_LISTING_RETURNING = """
    id, municipality_user_id, property_type, property_type_other,
    city, street, house_number, neighborhood,
    total_floors, parking_spots,
    ST_Y(location::geometry) AS latitude,
    ST_X(location::geometry) AS longitude,
    publisher_name, phone_number,
    created_at, updated_at
""".replace("\n", " ").strip()

_UNIT_SELECT = """
    u.id, u.listing_id, u.floor, u.rooms, u.bathrooms,
    u.has_accessibility, u.has_ac, u.has_bars, u.has_solar_heater,
    u.has_elevator, u.is_for_roommates, u.is_furnished, u.is_unit,
    u.is_kosher_kitchen, u.allows_pets, u.is_renovated,
    u.has_mamad, u.has_mamak, u.has_building_shelter, u.has_storage,
    u.built_sqm, u.monthly_price, u.rental_period, u.is_occupied, u.description,
    u.created_at, u.updated_at
""".replace("\n", " ").strip()


def _is_missing_coordinate(value: float | None) -> bool:
    return value is None or value == 0


async def _geocode_address(city: str, street: str, house_number: str) -> tuple[float, float]:
    address = f"{street} {house_number}, {city}, Israel"

    def _lookup():
        return _geolocator.geocode(address, timeout=10)

    try:
        location = await asyncio.to_thread(_lookup)
    except (GeocoderTimedOut, GeocoderServiceError, GeocoderUnavailable) as e:
        raise HTTPException(status_code=400, detail=_GEOCODE_ERROR_DETAIL) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=_GEOCODE_ERROR_DETAIL) from e

    if location is None:
        raise HTTPException(status_code=400, detail=_GEOCODE_ERROR_DETAIL)
    return float(location.latitude), float(location.longitude)


def _map_unit(row: asyncpg.Record) -> PropertyListingUnitRead:
    return PropertyListingUnitRead(
        id=row["id"],
        listing_id=row["listing_id"],
        floor=row["floor"],
        rooms=row["rooms"],
        bathrooms=row["bathrooms"],
        has_accessibility=row["has_accessibility"],
        has_ac=row["has_ac"],
        has_bars=row["has_bars"],
        has_solar_heater=row["has_solar_heater"],
        has_elevator=row["has_elevator"],
        is_for_roommates=row["is_for_roommates"],
        is_furnished=row["is_furnished"],
        is_unit=row["is_unit"],
        is_kosher_kitchen=row["is_kosher_kitchen"],
        allows_pets=row["allows_pets"],
        is_renovated=row["is_renovated"],
        has_mamad=row["has_mamad"],
        has_mamak=row["has_mamak"],
        has_building_shelter=row["has_building_shelter"],
        has_storage=row["has_storage"],
        built_sqm=row["built_sqm"],
        monthly_price=row["monthly_price"],
        rental_period=row["rental_period"],
        is_occupied=row["is_occupied"],
        description=row["description"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _map_listing(row: asyncpg.Record, units: list[PropertyListingUnitRead]) -> PropertyListingRead:
    return PropertyListingRead(
        id=row["id"],
        municipality_user_id=row["municipality_user_id"],
        property_type=row["property_type"],
        property_type_other=row["property_type_other"],
        city=row["city"],
        street=row["street"],
        house_number=row["house_number"],
        neighborhood=row["neighborhood"],
        total_floors=row["total_floors"],
        parking_spots=row["parking_spots"],
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        publisher_name=row["publisher_name"],
        phone_number=row["phone_number"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        units=units,
    )


async def _get_units_for_listing_ids(
    conn: asyncpg.Connection, listing_ids: list[UUID]
) -> dict[UUID, list[PropertyListingUnitRead]]:
    if not listing_ids:
        return {}

    rows = await conn.fetch(
        f"""
        SELECT {_UNIT_SELECT}
        FROM public.property_listing_units u
        WHERE u.listing_id = ANY($1::uuid[])
        ORDER BY u.created_at ASC
        """,
        listing_ids,
    )
    units_by_listing: dict[UUID, list[PropertyListingUnitRead]] = {
        listing_id: [] for listing_id in listing_ids
    }
    for row in rows:
        listing_id = row["listing_id"]
        units_by_listing.setdefault(listing_id, []).append(_map_unit(row))
    return units_by_listing


async def _insert_units(
    conn: asyncpg.Connection, listing_id: UUID, units: list[PropertyListingUnitCreate]
) -> None:
    for unit in units:
        await conn.execute(
            """
            INSERT INTO public.property_listing_units (
                listing_id, floor, rooms, bathrooms,
                has_accessibility, has_ac, has_bars, has_solar_heater,
                has_elevator, is_for_roommates, is_furnished, is_unit,
                is_kosher_kitchen, allows_pets, is_renovated,
                has_mamad, has_mamak, has_building_shelter, has_storage,
                built_sqm, monthly_price, rental_period, is_occupied, description
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
            )
            """,
            listing_id,
            unit.floor,
            unit.rooms,
            unit.bathrooms,
            unit.has_accessibility,
            unit.has_ac,
            unit.has_bars,
            unit.has_solar_heater,
            unit.has_elevator,
            unit.is_for_roommates,
            unit.is_furnished,
            unit.is_unit,
            unit.is_kosher_kitchen,
            unit.allows_pets,
            unit.is_renovated,
            unit.has_mamad,
            unit.has_mamak,
            unit.has_building_shelter,
            unit.has_storage,
            unit.built_sqm,
            unit.monthly_price,
            unit.rental_period,
            unit.is_occupied,
            unit.description,
        )


async def _fetch_listing_by_id(
    conn: asyncpg.Connection, listing_id: UUID
) -> PropertyListingRead | None:
    row = await conn.fetchrow(
        f"""
        SELECT {_LISTING_SELECT}
        FROM public.property_listings pl
        WHERE pl.id = $1
        """,
        listing_id,
    )
    if row is None:
        return None
    units_by_listing = await _get_units_for_listing_ids(conn, [listing_id])
    return _map_listing(row, units_by_listing.get(listing_id, []))


@router.post("", response_model=PropertyListingRead, status_code=status.HTTP_201_CREATED)
async def create_property_listing(
    body: PropertyListingCreate,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    latitude = body.latitude
    longitude = body.longitude
    if _is_missing_coordinate(latitude) or _is_missing_coordinate(longitude):
        latitude, longitude = await _geocode_address(
            city=body.city,
            street=body.street,
            house_number=body.house_number,
        )

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                listing_row = await conn.fetchrow(
                    f"""
                    INSERT INTO public.property_listings (
                        municipality_user_id, property_type, property_type_other,
                        city, street, house_number, neighborhood,
                        total_floors, parking_spots, location,
                        publisher_name, phone_number
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9,
                        ST_SetSRID(ST_MakePoint($10, $11), 4326),
                        $12, $13
                    )
                    RETURNING {_LISTING_RETURNING}
                    """,
                    current.id,
                    body.property_type,
                    body.property_type_other,
                    body.city,
                    body.street,
                    body.house_number,
                    body.neighborhood,
                    body.total_floors,
                    body.parking_spots,
                    longitude,
                    latitude,
                    body.publisher_name,
                    body.phone_number,
                )
                listing_id = listing_row["id"]
                await _insert_units(conn, listing_id, body.units)
                created = await _fetch_listing_by_id(conn, listing_id)
                if created is None:
                    raise HTTPException(status_code=500, detail="Failed to fetch created listing")
                return created
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.get("", response_model=list[PropertyListingRead])
async def list_property_listings(
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
    city: str | None = Query(default=None),
    property_type: PropertyType | None = Query(default=None),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    distance_meters: float | None = Query(default=None, gt=0),
):
    _ = current
    has_geo_filter = (
        latitude is not None and longitude is not None and distance_meters is not None
    )
    if any(v is not None for v in (latitude, longitude, distance_meters)) and not has_geo_filter:
        raise HTTPException(
            status_code=400,
            detail="latitude, longitude, and distance_meters must be provided together",
        )

    conditions: list[str] = []
    args: list[object] = []

    if city:
        args.append(city)
        conditions.append(f"pl.city = ${len(args)}")
    if property_type:
        args.append(property_type)
        conditions.append(f"pl.property_type = ${len(args)}")
    if has_geo_filter:
        args.append(longitude)
        lon_param = len(args)
        args.append(latitude)
        lat_param = len(args)
        args.append(distance_meters)
        distance_param = len(args)
        conditions.append(
            "ST_DWithin("
            "pl.location::geography, "
            f"ST_SetSRID(ST_MakePoint(${lon_param}, ${lat_param}), 4326)::geography, "
            f"${distance_param}"
            ")"
        )

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = (
        f"SELECT {_LISTING_SELECT} FROM public.property_listings pl "
        f"{where_clause} ORDER BY pl.created_at DESC"
    )

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            listing_rows = await conn.fetch(query, *args)
            listing_ids = [row["id"] for row in listing_rows]
            units_by_listing = await _get_units_for_listing_ids(conn, listing_ids)
            return [
                _map_listing(row, units_by_listing.get(row["id"], []))
                for row in listing_rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.get("/mine", response_model=list[PropertyListingRead])
async def list_my_property_listings(
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            listing_rows = await conn.fetch(
                f"""
                SELECT {_LISTING_SELECT}
                FROM public.property_listings pl
                WHERE pl.municipality_user_id = $1
                ORDER BY pl.created_at DESC
                """,
                current.id,
            )
            listing_ids = [row["id"] for row in listing_rows]
            units_by_listing = await _get_units_for_listing_ids(conn, listing_ids)
            return [
                _map_listing(row, units_by_listing.get(row["id"], []))
                for row in listing_rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.get("/{listing_id}", response_model=PropertyListingRead)
async def get_property_listing(
    listing_id: UUID,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    _ = current
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            listing = await _fetch_listing_by_id(conn, listing_id)
            if listing is None:
                raise HTTPException(status_code=404, detail="Property listing not found")
            return listing
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.patch("/{listing_id}", response_model=PropertyListingRead)
async def update_property_listing(
    listing_id: UUID,
    body: PropertyListingUpdate,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    data = body.model_dump(exclude_unset=True)
    units_data = data.pop("units", None)
    if not data and units_data is None:
        return await get_property_listing(listing_id)

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                existing = await conn.fetchrow(
                    """
                    SELECT
                        id,
                        municipality_user_id,
                        city,
                        street,
                        house_number,
                        ST_Y(location::geometry) AS latitude,
                        ST_X(location::geometry) AS longitude
                    FROM public.property_listings
                    WHERE id = $1
                    """,
                    listing_id,
                )
                if existing is None:
                    raise HTTPException(status_code=404, detail="Property listing not found")
                if existing["municipality_user_id"] != current.id:
                    raise HTTPException(
                        status_code=403,
                        detail="You can only update listings that you created",
                    )

                set_parts: list[str] = []
                args: list[object] = []

                def add_arg(value: object) -> str:
                    args.append(value)
                    return f"${len(args)}"

                for key in [
                    "property_type",
                    "property_type_other",
                    "city",
                    "street",
                    "house_number",
                    "neighborhood",
                    "total_floors",
                    "parking_spots",
                    "publisher_name",
                    "phone_number",
                ]:
                    if key in data:
                        set_parts.append(f"{key} = {add_arg(data[key])}")

                address_updated = any(
                    key in data for key in ("city", "street", "house_number")
                )
                coordinates_provided = "latitude" in data or "longitude" in data
                resolved_city = data.get("city", existing["city"])
                resolved_street = data.get("street", existing["street"])
                resolved_house_number = data.get("house_number", existing["house_number"])

                resolved_latitude: float | None = None
                resolved_longitude: float | None = None

                if address_updated and not coordinates_provided:
                    resolved_latitude, resolved_longitude = await _geocode_address(
                        city=resolved_city,
                        street=resolved_street,
                        house_number=resolved_house_number,
                    )
                elif coordinates_provided:
                    candidate_latitude = (
                        data["latitude"] if "latitude" in data else float(existing["latitude"])
                    )
                    candidate_longitude = (
                        data["longitude"] if "longitude" in data else float(existing["longitude"])
                    )
                    if _is_missing_coordinate(candidate_latitude) or _is_missing_coordinate(
                        candidate_longitude
                    ):
                        resolved_latitude, resolved_longitude = await _geocode_address(
                            city=resolved_city,
                            street=resolved_street,
                            house_number=resolved_house_number,
                        )
                    else:
                        resolved_latitude = float(candidate_latitude)
                        resolved_longitude = float(candidate_longitude)

                if (
                    resolved_latitude is not None
                    and resolved_longitude is not None
                ):
                    p_lon = add_arg(resolved_longitude)
                    p_lat = add_arg(resolved_latitude)
                    set_parts.append(
                        f"location = ST_SetSRID(ST_MakePoint({p_lon}, {p_lat}), 4326)"
                    )

                if set_parts:
                    set_parts.append("updated_at = NOW()")
                    args.append(listing_id)
                    await conn.execute(
                        f"""
                        UPDATE public.property_listings
                        SET {", ".join(set_parts)}
                        WHERE id = ${len(args)}
                        """,
                        *args,
                    )

                if units_data is not None:
                    await conn.execute(
                        "DELETE FROM public.property_listing_units WHERE listing_id = $1",
                        listing_id,
                    )
                    await _insert_units(conn, listing_id, [PropertyListingUnitCreate(**u) for u in units_data])

                updated = await _fetch_listing_by_id(conn, listing_id)
                if updated is None:
                    raise HTTPException(status_code=500, detail="Failed to fetch updated listing")
                return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property_listing(
    listing_id: UUID,
    current: Annotated[MunicipalityUserRecord, Depends(get_current_user)],
):
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT municipality_user_id
                FROM public.property_listings
                WHERE id = $1
                """,
                listing_id,
            )
            if existing is None:
                raise HTTPException(status_code=404, detail="Property listing not found")
            if existing["municipality_user_id"] != current.id:
                raise HTTPException(
                    status_code=403,
                    detail="You can only delete listings that you created",
                )

            result = await conn.execute(
                "DELETE FROM public.property_listings WHERE id = $1",
                listing_id,
            )
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Property listing not found")
            return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
