"""
vector_ingestion.py

Generate OpenAI embeddings for existing database rows and store them in pgvector.

Idempotency: only rows with `embedding IS NULL` are selected and updated.
Safe resume: if the script is interrupted, rerunning will continue where it left off.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Iterable, Optional

import asyncpg
from openai import AsyncOpenAI

from app.core.config import settings


logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dims
VECTOR_COLUMN = "embedding"


def _clean_str(v: Any) -> Optional[str]:
    '''
    Clean a string value by stripping whitespace and converting to string.
    Returns None if the value is None or cannot be converted to a string.
    '''
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return str(v).strip() or None


def _json_pretty(v: Any, *, max_chars: int = 2000) -> Optional[str]:
    '''
    Convert a dictionary to a pretty JSON string.
    Returns None if the value is None.
    '''
    if v is None:
        return None
    try:
        s = json.dumps(v, ensure_ascii=False, default=str)
    except Exception:
        s = str(v)
    s = s.strip()
    if not s:
        return None
    if len(s) > max_chars:
        return s[:max_chars] + "..."
    return s


def _truncate_text(text: str, *, max_chars: int = 6000) -> str:
    '''
    Truncate a text string to a maximum number of characters.
    Returns the truncated text if it exceeds the maximum number of characters.
    '''
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


def _format_stat_location(*, semel_yish: Any, stat_2022: Any) -> str:
    '''
    Format the statistical location of a row.
    Returns a string with the semel_yish and stat_2022 values if they are not None.
    '''
    semel = _clean_str(semel_yish)
    stat = _clean_str(stat_2022)
    parts = []
    if semel:
        parts.append(f"semel_yish={semel}")
    if stat:
        parts.append(f"stat_2022={stat}")
    return " | ".join(parts) if parts else "Eilat (statistical area unknown)"


def format_airbnb_listing(row: dict[str, Any]) -> str:
    '''
    Format an Airbnb listing row for embedding.
    Returns a string with the title, description, location_subtitle, price_numeric, price_per_night, rating_value, person_capacity, lat, lng, and stat_loc values.
    '''
    title = _clean_str(row.get("title"))
    description = _clean_str(row.get("description"))
    location_subtitle = _clean_str(row.get("location_subtitle"))
    price_numeric = row.get("price_numeric")
    price_per_night = row.get("price_per_night")
    rating_value = row.get("rating_value")
    person_capacity = row.get("person_capacity")
    lat = row.get("coordinates_latitude")
    lng = row.get("coordinates_longitude")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Airbnb listing in Eilat."]
    if title:
        bits.append(f"Title: {title}.")
    if location_subtitle:
        bits.append(f"Location: {location_subtitle}.")
    if description:
        bits.append(f"Description: {description}.")
    pricing_bits = []
    if price_numeric is not None:
        pricing_bits.append(f"price_numeric={price_numeric}")
    if price_per_night is not None:
        pricing_bits.append(f"price_per_night={price_per_night}")
    if pricing_bits:
        bits.append("Pricing: " + ", ".join(pricing_bits) + ".")
    rating_bits = []
    if rating_value is not None:
        rating_bits.append(f"rating_value={rating_value}")
    if person_capacity is not None:
        rating_bits.append(f"person_capacity={person_capacity}")
    if rating_bits:
        bits.append("Rating/Capacity: " + ", ".join(rating_bits) + ".")
    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def format_synagogue(row: dict[str, Any]) -> str:
    '''
    Format a synagogue row for embedding.
    Returns a string with the name, name_he, type, type_he, address, lat, lng, and stat_loc values.
    '''
    name = _clean_str(row.get("name"))
    name_he = _clean_str(row.get("name_he"))
    synagogue_type = _clean_str(row.get("type"))
    synagogue_type_he = _clean_str(row.get("type_he"))
    address = _clean_str(row.get("address"))
    lat = row.get("location_lat")
    lng = row.get("location_lng")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Synagogue in Eilat."]
    if name:
        bits.append(f"Name: {name}.")
    if name_he:
        bits.append(f"Name (Hebrew): {name_he}.")
    if synagogue_type:
        bits.append(f"Type: {synagogue_type}.")
    if synagogue_type_he:
        bits.append(f"Type (Hebrew): {synagogue_type_he}.")
    if address:
        bits.append(f"Address: {address}.")
    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def format_educational_institution(row: dict[str, Any]) -> str:
    '''
    Format an educational institution row for embedding.
    Returns a string with the institution_code, institution_name, address, full_address, type_of_supervision, type_of_education, education_phase, lat, lon, and stat_loc values.
    '''
    institution_code = _clean_str(row.get("institution_code"))
    institution_name = _clean_str(row.get("institution_name"))
    address = _clean_str(row.get("address"))
    full_address = _clean_str(row.get("full_address"))
    type_of_supervision = _clean_str(row.get("type_of_supervision"))
    type_of_education = _clean_str(row.get("type_of_education"))
    education_phase = _clean_str(row.get("education_phase"))
    lat = row.get("lat")
    lon = row.get("lon")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Educational institution in Eilat."]
    if institution_code:
        bits.append(f"Institution code: {institution_code}.")
    if institution_name:
        bits.append(f"Institution name: {institution_name}.")
    if type_of_supervision:
        bits.append(f"Type of supervision: {type_of_supervision}.")
    if type_of_education:
        bits.append(f"Type of education: {type_of_education}.")
    if education_phase:
        bits.append(f"Education phase: {education_phase}.")
    if address:
        bits.append(f"Address: {address}.")
    if full_address:
        bits.append(f"Full address: {full_address}.")
    if lat is not None and lon is not None:
        bits.append(f"Coordinates: lat={lat}, lon={lon}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def format_matnasim(row: dict[str, Any]) -> str:
    '''
    Format a matnasim row for embedding.
    Returns a string with the matnas_name, full_address, person_in_charge, phone_number, activity_days, facility_area, occupancy, number_of_activity_rooms, shelter_and_where, lat, lng, and stat_loc values.
    '''
    matnas_name = _clean_str(row.get("matnas_name"))
    full_address = _clean_str(row.get("full_address"))
    person_in_charge = _clean_str(row.get("person_in_charge"))
    phone_number = _clean_str(row.get("phone_number"))
    activity_days = _clean_str(row.get("activity_days"))
    facility_area = row.get("facility_area")
    occupancy = row.get("occupancy")
    number_of_activity_rooms = _clean_str(row.get("number_of_activity_rooms"))
    shelter_and_where = _clean_str(row.get("shelter_and_where"))
    lat = row.get("location_lat")
    lng = row.get("location_lng")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Matnas community center in Eilat."]
    if matnas_name:
        bits.append(f"Name: {matnas_name}.")
    if full_address:
        bits.append(f"Address: {full_address}.")
    if person_in_charge:
        bits.append(f"Contact person: {person_in_charge}.")
    if phone_number:
        bits.append(f"Phone: {phone_number}.")
    if activity_days:
        bits.append(f"Activity days: {activity_days}.")
    if shelter_and_where:
        bits.append(f"Shelter and where: {shelter_and_where}.")

    numeric_bits = []
    if facility_area is not None:
        numeric_bits.append(f"facility_area={facility_area}")
    if occupancy is not None:
        numeric_bits.append(f"occupancy={occupancy}")
    if number_of_activity_rooms:
        numeric_bits.append(f"rooms={number_of_activity_rooms}")
    if numeric_bits:
        bits.append("Facilities: " + ", ".join(numeric_bits) + ".")

    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def format_hotels_listing(row: dict[str, Any]) -> str:
    '''
    Format a hotels listing row for embedding.
    Returns a string with the name, description, type, rating_value, location_fulladdress, url, lat, lng, and stat_loc values.
    '''
    name = _clean_str(row.get("name"))
    description = _clean_str(row.get("description"))
    listing_type = _clean_str(row.get("type"))
    rating_value = row.get("rating_value")
    location_fulladdress = _clean_str(row.get("location_fulladdress"))
    url = _clean_str(row.get("url"))
    lat = row.get("coordinates_latitude")
    lng = row.get("coordinates_longitude")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Hotel listing in Eilat."]
    if name:
        bits.append(f"Name: {name}.")
    if listing_type:
        bits.append(f"Type: {listing_type}.")
    if location_fulladdress:
        bits.append(f"Address: {location_fulladdress}.")
    if rating_value is not None:
        bits.append(f"Rating: {rating_value}.")
    if url:
        bits.append(f"Website URL: {url}.")
    if description:
        bits.append(f"Description: {description}.")
    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def _format_business_place_closed_flags(row: dict[str, Any]) -> str:
    '''
    Format the closed flags of a business place.
    Returns a string with the temporarily_closed and permanently_closed values if they are not None.
    '''
    temporarily_closed = row.get("temporarily_closed")
    permanently_closed = row.get("permanently_closed")
    if temporarily_closed is True and permanently_closed is True:
        return "Status: temporarily and permanently closed."
    if temporarily_closed is True:
        return "Status: temporarily closed."
    if permanently_closed is True:
        return "Status: permanently closed."
    if temporarily_closed is False or permanently_closed is False:
        # Only mention if at least one is explicitly false.
        if temporarily_closed is False and permanently_closed is False:
            return "Status: open (not marked closed)."
    return "Status: availability unknown."


def format_coffee_shop(row: dict[str, Any]) -> str:
    '''
    Format a coffee shop row for embedding.
    Returns a string with the title, description, category_name, total_score, url, website, street, activity_times, lat, lng, and stat_loc values.
    '''
    title = _clean_str(row.get("title"))
    description = _clean_str(row.get("description"))
    category_name = _clean_str(row.get("category_name"))
    total_score = row.get("total_score")
    url = _clean_str(row.get("url"))
    website = _clean_str(row.get("website"))
    street = _clean_str(row.get("street"))
    activity_times = row.get("activity_times")
    activity_times_text = _json_pretty(activity_times)
    lat = row.get("location_lat")
    lng = row.get("location_lng")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Coffee shop in Eilat."]
    if title:
        bits.append(f"Name: {title}.")
    if category_name:
        bits.append(f"Category: {category_name}.")
    if street:
        bits.append(f"Street: {street}.")
    if description:
        bits.append(f"Description: {description}.")
    if total_score is not None:
        bits.append(f"Total score: {total_score}.")

    bits.append(_format_business_place_closed_flags(row))

    if url:
        bits.append(f"URL: {url}.")
    if website:
        bits.append(f"Website: {website}.")
    if activity_times_text:
        bits.append(f"Activity times: {activity_times_text}.")
    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def format_restaurant(row: dict[str, Any]) -> str:
    '''
    Format a restaurant row for embedding.
    Returns a string with the title, description, category_name, total_score, url, website, street, activity_times, lat, lng, and stat_loc values.
    '''
    title = _clean_str(row.get("title"))
    description = _clean_str(row.get("description"))
    category_name = _clean_str(row.get("category_name"))
    total_score = row.get("total_score")
    url = _clean_str(row.get("url"))
    website = _clean_str(row.get("website"))
    street = _clean_str(row.get("street"))
    activity_times = row.get("activity_times")
    activity_times_text = _json_pretty(activity_times)
    lat = row.get("location_lat")
    lng = row.get("location_lng")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["Restaurant in Eilat."]
    if title:
        bits.append(f"Name: {title}.")
    if category_name:
        bits.append(f"Category: {category_name}.")
    if street:
        bits.append(f"Street: {street}.")
    if description:
        bits.append(f"Description: {description}.")
    if total_score is not None:
        bits.append(f"Total score: {total_score}.")

    bits.append(_format_business_place_closed_flags(row))

    if url:
        bits.append(f"URL: {url}.")
    if website:
        bits.append(f"Website: {website}.")
    if activity_times_text:
        bits.append(f"Activity times: {activity_times_text}.")
    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


def format_osm_facility(row: dict[str, Any]) -> str:
    '''
    Format an OSM facility row for embedding.
    Returns a string with the name, facility_type, lat, lng, and stat_loc values.
    '''     
    name = _clean_str(row.get("name"))
    facility_type = _clean_str(row.get("facility_type"))
    lat = row.get("location_lat")
    lng = row.get("location_lng")

    stat_loc = _format_stat_location(
        semel_yish=row.get("semel_yish"), stat_2022=row.get("stat_2022")
    )

    bits: list[str] = ["OSM facility in Eilat."]
    if name:
        bits.append(f"Name: {name}.")
    if facility_type:
        bits.append(f"Facility type: {facility_type}.")
    if lat is not None and lng is not None:
        bits.append(f"Coordinates: lat={lat}, lng={lng}.")
    bits.append(f"Statistical area context: {stat_loc}.")
    return _truncate_text(" ".join(bits))


@dataclass(frozen=True) 
class TableSpec:
    '''
    A dataclass to specify a table for ingestion.
    Returns a TableSpec object with the table, pk_column, select_columns, formatter, and pk_as_str values.
    '''
    table: str
    pk_column: str
    '''
    The primary key column of the table.
    '''
    select_columns: list[str]
    '''
    The columns to select from the table.
    '''
    formatter: Callable[[dict[str, Any]], str]
    '''
    The formatter function to format the rows of the table.
    '''
    pk_as_str: bool = False
    '''
    Whether to convert the primary key to a string.
    '''


TABLE_SPECS: list[TableSpec] = [
    TableSpec(
        table="airbnb_listings",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "title",
            "description",
            "location_subtitle",
            "price_qualifier",
            "price_numeric",
            "num_nights",
            "price_per_night",
            "rating_value",
            "person_capacity",
            "coordinates_latitude",
            "coordinates_longitude",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_airbnb_listing,
    ),
    TableSpec(
        table="synagogues",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "name",
            "name_he",
            "type",
            "type_he",
            "address",
            "location_lat",
            "location_lng",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_synagogue,
    ),
    TableSpec(
        table="educational_institutions",
        pk_column="id",
        select_columns=[
            "id",
            "institution_code",
            "institution_name",
            "address",
            "full_address",
            "type_of_supervision",
            "type_of_education",
            "education_phase",
            "lat",
            "lon",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_educational_institution,
    ),
    TableSpec(
        table="matnasim",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "matnas_name",
            "full_address",
            "person_in_charge",
            "phone_number",
            "activity_days",
            "shelter_and_where",
            "facility_area",
            "occupancy",
            "number_of_activity_rooms",
            "location_lat",
            "location_lng",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_matnasim,
    ),
    TableSpec(
        table="hotels_listings",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "hotelid",
            "name",
            "description",
            "type",
            "rating_value",
            "location_fulladdress",
            "url",
            "coordinates_latitude",
            "coordinates_longitude",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_hotels_listing,
    ),
    TableSpec(
        table="coffee_shops",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "cid",
            "title",
            "description",
            "category_name",
            "total_score",
            "temporarily_closed",
            "permanently_closed",
            "url",
            "website",
            "street",
            "activity_times",
            "location_lat",
            "location_lng",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_coffee_shop,
    ),
    TableSpec(
        table="restaurants",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "cid",
            "title",
            "description",
            "category_name",
            "total_score",
            "temporarily_closed",
            "permanently_closed",
            "url",
            "website",
            "street",
            "activity_times",
            "location_lat",
            "location_lng",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_restaurant,
    ),
    TableSpec(
        table="osm_city_facilities",
        pk_column="uuid",
        select_columns=[
            "uuid",
            "name",
            "facility_type",
            "location_lat",
            "location_lng",
            "semel_yish",
            "stat_2022",
        ],
        formatter=format_osm_facility,
    ),
]


async def _fetch_embedding_with_retry(
    client: AsyncOpenAI,
    text: str,
    *,
    max_attempts: int = 3,
    base_sleep_s: float = 1.0,
) -> Optional[list[float]]:
    '''
    Fetch an embedding from OpenAI with retry.
    Returns the embedding if successful, None if all attempts fail.
    '''
    last_exc: Optional[BaseException] = None
    for attempt in range(1, max_attempts + 1):
        try:
            resp = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text,
            )
            embedding = resp.data[0].embedding
            return embedding
        except Exception as exc:  # OpenAI errors differ by version; keep broad but logged.
            last_exc = exc
            sleep_s = base_sleep_s * (2 ** (attempt - 1))
            logger.warning(
                "OpenAI embedding failed (attempt %s/%s). Sleeping %.1fs. Error: %s",
                attempt,
                max_attempts,
                sleep_s,
                exc,
            )
            if attempt < max_attempts:
                await asyncio.sleep(sleep_s)
    logger.error("OpenAI embedding failed after %s attempts: %s", max_attempts, last_exc)
    return None


async def ingest_table(
    *,
    conn: asyncpg.Connection,
    client: AsyncOpenAI,
    spec: TableSpec,
    progress_every: int = 50,
    per_table_limit: Optional[int] = None,
) -> dict[str, int]:
    '''
    Ingest a table into the database.
    Returns a dictionary with the number of rows seen, updated, and failed.
    '''
    select_cols = ", ".join(spec.select_columns)
    select_sql = (
        f"SELECT {select_cols} "
        f"FROM {spec.table} "
        f"WHERE {VECTOR_COLUMN} IS NULL "
        f"ORDER BY {spec.pk_column}"
    )
    if per_table_limit is not None:
        select_sql += f" LIMIT {int(per_table_limit)}"

    update_sql = (
        f"UPDATE {spec.table} "
        f"SET {VECTOR_COLUMN} = $1::vector "
        f"WHERE {spec.pk_column} = $2"
    )

    logger.info("Starting table '%s' (pk=%s)", spec.table, spec.pk_column)
    updated = 0
    seen = 0
    failed_rows = 0

    rows = await conn.fetch(select_sql)
    for row in rows:
        seen += 1
        row_dict = dict(row)

        semantic_text = spec.formatter(row_dict)
        if not semantic_text.strip():
            failed_rows += 1
            logger.warning(
                "Empty semantic text for %s.%s=%r; skipping",
                spec.table,
                spec.pk_column,
                row_dict.get(spec.pk_column),
            )
            continue

        vector = await _fetch_embedding_with_retry(client, semantic_text)
        if vector is None:
            failed_rows += 1
            continue

        pk_val = row_dict.get(spec.pk_column)
        if spec.pk_as_str and pk_val is not None:
            pk_val = str(pk_val)

        try:
            # Requirement: format float list with json.dumps() for asyncpg.
            await conn.execute(update_sql, json.dumps(vector), pk_val)
            updated += 1
        except Exception as exc:
            failed_rows += 1
            logger.exception(
                "DB update failed for %s.%s=%r: %s",
                spec.table,
                spec.pk_column,
                pk_val,
                exc,
            )

        if seen % progress_every == 0:
            logger.info(
                "Progress %s: seen=%s updated=%s failed=%s",
                spec.table,
                seen,
                updated,
                failed_rows,
            )

    if updated == 0 and seen == 0:
        logger.info("No rows to update for table '%s' (embedding already present).", spec.table)
    else:
        logger.info(
            "Finished table '%s': seen=%s updated=%s failed=%s",
            spec.table,
            seen,
            updated,
            failed_rows,
        )
    return {"seen": seen, "updated": updated, "failed": failed_rows}


async def run_ingestion(*, per_table_limit: Optional[int], progress_every: int) -> None:
    '''
    Run the ingestion process.
    Returns None.
    '''
    key = settings.openai_api_key
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add OPENAI_API_KEY to your .env file or set it in the environment."
        )

    dsn = settings.DATABASE_URL
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set in app.core.config.settings.")

    client = AsyncOpenAI(api_key=key)

    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=5,
        command_timeout=60,
        statement_cache_size=0,
    )

    stop_event = asyncio.Event()

    def _handle_stop(*_: Any) -> None:
        logger.warning("Received shutdown signal; will stop after current row.")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_stop)
        except (NotImplementedError, RuntimeError):
            # Windows event loop may not support signal handlers for non-main threads.
            pass

    try:
        async with pool.acquire() as conn:
            # If the user Ctrl+C's, we don't want to abort mid-UPDATE.
            for spec in TABLE_SPECS:
                if stop_event.is_set():
                    break
                await ingest_table(
                    conn=conn,
                    client=client,
                    spec=spec,
                    progress_every=progress_every,
                    per_table_limit=per_table_limit,
                )
    finally:
        await pool.close()


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    '''
    Parse command line arguments.
    Returns a Namespace object with the parsed arguments.
    '''
    parser = argparse.ArgumentParser(description="Generate and store pgvector embeddings via OpenAI.")
    parser.add_argument(
        "--progress-every",
        type=int,
        default=50,
        help="Log progress every N processed rows per table.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional: maximum rows to process per table (for testing).",
    )
    return parser.parse_args(argv)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    args = parse_args()

    try:
        asyncio.run(run_ingestion(per_table_limit=args.limit, progress_every=args.progress_every))
    except KeyboardInterrupt:
        # asyncio cancellation may surface as KeyboardInterrupt
        logger.warning("Interrupted by user; exiting.")
        sys.exit(130)


if __name__ == "__main__":
    '''
    Main function to run the vector ingestion script.
    Returns None.
    '''
    main()

