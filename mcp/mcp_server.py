"""
CityStrata Tactical MCP Server — RAG + spatial tools for evacuee relocation in Eilat.

Transport: stdio (default for Cursor / Claude Desktop).

Environment:
  DATABASE_URL   — PostgreSQL connection string (pgvector + PostGIS)
  OPENAI_API_KEY — OpenAI API key for text-embedding-3-small
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import asyncpg
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

# MCP uses stdio for JSON-RPC — never write logs to stdout (breaks the protocol).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stderr,
    force=True,
)
logger = logging.getLogger("citystrata_mcp")

# ---------------------------------------------------------------------------
# Environment (.env)
# ---------------------------------------------------------------------------

_EMBEDDING_MODEL = "text-embedding-3-small"


def _load_env() -> None:
    """Load .env from common locations (project root, mcp dir, cwd)."""
    here = Path(__file__).resolve().parent
    candidates = [
        here / ".env",
        here.parent / ".env",
        Path.cwd() / ".env",
    ]
    for p in candidates:
        if p.is_file():
            load_dotenv(p, override=False)
            logger.info("Loaded environment from %s", p)
            return
    load_dotenv(override=False)


_load_env()


def _require_env(name: str) -> str:
    v = os.getenv(name)
    if not v or not str(v).strip():
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            "Set it in .env or the MCP server env block in Cursor."
        )
    return str(v).strip()


# ---------------------------------------------------------------------------
# DB pool + embeddings (stdlib urllib in thread executor — see _embed_text)
# ---------------------------------------------------------------------------

_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()


async def _get_pool() -> asyncpg.Pool:
    global _pool
    async with _pool_lock:
        if _pool is None:
            dsn = _require_env("DATABASE_URL")
            logger.info("Creating asyncpg pool (timeout 60s for first connection)...")
            # statement_timeout at pool startup survives PgBouncer transaction pooling better than
            # SET LOCAL inside a transaction (which can be ignored or reset per transaction).
            _pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=1,
                max_size=5,
                command_timeout=120,
                statement_cache_size=0,
                timeout=60,
                server_settings={
                    # PostgreSQL accepts e.g. '120s'; aligns with command_timeout above.
                    "statement_timeout": "120s",
                },
            )
            logger.info("asyncpg pool created")
        return _pool


def _embed_text_sync(text: str) -> list[float]:
    """Pure stdlib HTTP POST — bypasses httpx (can stall in Windows MCP child with piped stdout)."""
    api_key = _require_env("OPENAI_API_KEY")
    payload = json.dumps(
        {
            "model": _EMBEDDING_MODEL,
            "input": text,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"OpenAI embeddings HTTP {e.code}: {err_body[:800]}"
        ) from e
    data = json.loads(raw)
    return list(data["data"][0]["embedding"])


async def _embed_text(text: str) -> list[float]:
    """Run stdlib HTTP in a thread pool so the event loop stays responsive under MCP stdio."""
    loop = asyncio.get_running_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _embed_text_sync, text),
        timeout=90.0,
    )


def _vector_literal(vec: list[float]) -> str:
    """Serialize embedding for pgvector cast in SQL ($1::vector)."""
    return json.dumps(vec)


def _approx_lat_lng_bounds(
    center_lat: float,
    center_lng: float,
    radius_km: float,
    *,
    pad: float = 1.25,
) -> tuple[float, float, float, float]:
    """
    Rough WGS84 bounding box (degrees) for cheap SQL prefiltering before
    ST_DWithin / ::geography on large tables. Pad slightly so we do not miss edge cases.
    """
    dlat = (radius_km / 111.0) * pad
    cl = math.cos(math.radians(center_lat))
    denom = 111.0 * max(0.2, cl)
    dlon = (radius_km / denom) * pad
    lat_min = center_lat - dlat
    lat_max = center_lat + dlat
    lng_min = center_lng - dlon
    lng_max = center_lng + dlon
    return (lat_min, lat_max, lng_min, lng_max)


def _mcp_stderr(msg: str) -> None:
    """Visible progress when running with tactical_agent --forward-server-stderr."""
    print(msg, file=sys.stderr, flush=True)


# Debug trace file — avoids stderr pipe deadlocks on Windows when MCP stdio is used.
_DEBUG_LOG = Path(tempfile.gettempdir()) / "citystrata_mcp_debug.log"


def _dbg(msg: str) -> None:
    """Append to temp file — safe on Windows; use to pinpoint hangs without --forward-server-stderr."""
    try:
        with _DEBUG_LOG.open("a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Table metadata (whitelist — never interpolate untrusted table names)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TableSpec:
    sql_name: str
    pk_column: str
    lat_col: str
    lng_col: str
    # Human-readable fields for tool output
    label_sql: str  # SQL expression aliased as label
    address_sql: str  # SQL expression aliased as address (may be empty string)


TABLE_REGISTRY: dict[str, TableSpec] = {
    "airbnb_listings": TableSpec(
        sql_name="airbnb_listings",
        pk_column="uuid",
        lat_col="coordinates_latitude",
        lng_col="coordinates_longitude",
        label_sql="COALESCE(title, '')",
        address_sql="COALESCE(location_subtitle, '')",
    ),
    "hotels_listings": TableSpec(
        sql_name="hotels_listings",
        pk_column="uuid",
        lat_col="coordinates_latitude",
        lng_col="coordinates_longitude",
        label_sql="COALESCE(name, '')",
        address_sql="COALESCE(location_fulladdress, '')",
    ),
    "synagogues": TableSpec(
        sql_name="synagogues",
        pk_column="uuid",
        lat_col="location_lat",
        lng_col="location_lng",
        label_sql="COALESCE(name, name_he, '')",
        address_sql="COALESCE(address, '')",
    ),
    "educational_institutions": TableSpec(
        sql_name="educational_institutions",
        pk_column="id",
        lat_col="lat",
        lng_col="lon",
        label_sql="COALESCE(institution_name, '')",
        address_sql="COALESCE(full_address, address, '')",
    ),
    "matnasim": TableSpec(
        sql_name="matnasim",
        pk_column="uuid",
        lat_col="location_lat",
        lng_col="location_lng",
        label_sql="COALESCE(matnas_name, '')",
        address_sql="COALESCE(full_address, '')",
    ),
    "coffee_shops": TableSpec(
        sql_name="coffee_shops",
        pk_column="uuid",
        lat_col="location_lat",
        lng_col="location_lng",
        label_sql="COALESCE(title, '')",
        address_sql="COALESCE(street, '')",
    ),
    "restaurants": TableSpec(
        sql_name="restaurants",
        pk_column="uuid",
        lat_col="location_lat",
        lng_col="location_lng",
        label_sql="COALESCE(title, '')",
        address_sql="COALESCE(street, '')",
    ),
    "osm_city_facilities": TableSpec(
        sql_name="osm_city_facilities",
        pk_column="uuid",
        lat_col="location_lat",
        lng_col="location_lng",
        label_sql="COALESCE(name, facility_type, '')",
        address_sql="''",
    ),
}


def _resolve_table(table_name: str) -> TableSpec:
    key = (table_name or "").strip().lower()
    if key not in TABLE_REGISTRY:
        allowed = ", ".join(sorted(TABLE_REGISTRY))
        raise ValueError(
            f"Unknown or disallowed table_name={table_name!r}. Allowed: {allowed}"
        )
    return TABLE_REGISTRY[key]


# ---------------------------------------------------------------------------
# MCP app
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "CityStrata Tactical",
    instructions=(
        "Tactical RAG + PostGIS tools for matching evacuee families to housing "
        "and amenities in Eilat (cluster context, vector search, location scoring)."
    ),
)


@mcp.tool()
async def get_family_tactical_context(family_id: str) -> dict[str, Any]:
    """
    Load a family profile by UUID and join the selected macro matching result.
    Computes the assigned cluster geographic center from statistical area centroids.

    Args:
        family_id: evacuee_family_profiles.uuid as string.
    """
    logger.info("Tool get_family_tactical_context start family_id=%r", family_id)
    try:
        fid = UUID(str(family_id).strip())
    except ValueError as e:
        raise ValueError(f"family_id must be a valid UUID; got {family_id!r}") from e

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                efp.uuid::text AS family_uuid,
                efp.family_name,
                efp.total_people,
                efp.infants,
                efp.preschool,
                efp.elementary,
                efp.youth,
                efp.adults,
                efp.seniors,
                efp.has_mobility_disability,
                efp.has_car,
                efp.essential_education,
                efp.education_proximity_importance,
                efp.religious_affiliation,
                efp.needs_synagogue,
                efp.culture_frequency,
                efp.matnas_participation,
                efp.social_venues_importance,
                efp.needs_community_proximity,
                efp.accommodation_preference,
                efp.estimated_stay_duration,
                efp.needs_medical_proximity,
                efp.services_importance,
                efp.notes,
                efp.selected_matching_result_id::text AS selected_matching_result_id,
                mr.id::text AS matching_result_id,
                mr.recommended_cluster,
                mr.recommended_cluster_number,
                mr.confidence,
                mr.reasoning,
                mr.alternative_cluster,
                mr.alternative_reasoning,
                mr.flags,
                mr.run_id::text AS run_id
            FROM evacuee_family_profiles efp
            LEFT JOIN matching_results mr
                ON mr.id = efp.selected_matching_result_id
            WHERE efp.uuid = $1::uuid
            """,
            fid,
        )

    if not row:
        logger.info("Tool get_family_tactical_context done ok=False (profile not found)")
        return {
            "ok": False,
            "error": f"No evacuee_family_profiles row for uuid={family_id}",
        }

    family_needs = {
        "family_uuid": row["family_uuid"],
        "family_name": row["family_name"],
        "composition": {
            "total_people": row["total_people"],
            "infants": row["infants"],
            "preschool": row["preschool"],
            "elementary": row["elementary"],
            "youth": row["youth"],
            "adults": row["adults"],
            "seniors": row["seniors"],
        },
        "mobility_and_transport": {
            "has_mobility_disability": row["has_mobility_disability"],
            "has_car": row["has_car"],
        },
        "education": {
            "essential_education": list(row["essential_education"] or []),
            "education_proximity_importance": row["education_proximity_importance"],
        },
        "religious_and_culture": {
            "religious_affiliation": row["religious_affiliation"],
            "needs_synagogue": row["needs_synagogue"],
            "culture_frequency": row["culture_frequency"],
        },
        "community_and_social": {
            "matnas_participation": row["matnas_participation"],
            "social_venues_importance": row["social_venues_importance"],
            "needs_community_proximity": row["needs_community_proximity"],
        },
        "housing": {
            "accommodation_preference": row["accommodation_preference"],
            "estimated_stay_duration": row["estimated_stay_duration"],
        },
        "services": {
            "needs_medical_proximity": row["needs_medical_proximity"],
            "services_importance": row["services_importance"],
        },
        "notes": row["notes"],
    }

    matching = None
    if row["matching_result_id"]:
        matching = {
            "matching_result_id": row["matching_result_id"],
            "recommended_cluster": row["recommended_cluster"],
            "recommended_cluster_number": row["recommended_cluster_number"],
            "confidence": row["confidence"],
            "reasoning": row["reasoning"],
            "alternative_cluster": row["alternative_cluster"],
            "alternative_reasoning": row["alternative_reasoning"],
            "flags": row["flags"],
            "run_id": row["run_id"],
        }

    cluster_center: Optional[dict[str, Any]] = None
    warnings: list[str] = []

    if not row["selected_matching_result_id"]:
        warnings.append(
            "selected_matching_result_id is NULL; macro agent result not linked — "
            "cannot compute cluster center from cluster_assignments."
        )
    elif row["run_id"] is None or row["recommended_cluster_number"] is None:
        warnings.append("Matching result missing run_id or recommended_cluster_number.")
    else:
        async with pool.acquire() as conn:
            crow = await conn.fetchrow(
                """
                SELECT
                    AVG(
                        ST_Y(
                            COALESCE(sa.centroid, ST_Centroid(sa.geom))
                        )
                    ) AS center_lat,
                    AVG(
                        ST_X(
                            COALESCE(sa.centroid, ST_Centroid(sa.geom))
                        )
                    ) AS center_lng,
                    COUNT(*)::int AS area_count
                FROM cluster_assignments ca
                JOIN statistical_areas sa
                  ON sa.stat_2022 = ca.stat_2022
                 AND sa.semel_yish = 2600
                WHERE ca.run_id = $1::uuid
                  AND ca.cluster = $2
                """,
                UUID(row["run_id"]),
                int(row["recommended_cluster_number"]),
            )
        if crow and crow["area_count"]:
            cluster_center = {
                "center_lat": float(crow["center_lat"])
                if crow["center_lat"] is not None
                else None,
                "center_lng": float(crow["center_lng"])
                if crow["center_lng"] is not None
                else None,
                "areas_used": crow["area_count"],
                "method": "mean of statistical_areas centroid (or polygon centroid fallback)",
            }
        else:
            warnings.append(
                "No statistical areas found for this run/cluster; cluster center unknown."
            )

    logger.info(
        "Tool get_family_tactical_context done ok=True family=%s cluster_center=%s",
        family_needs.get("family_uuid"),
        cluster_center is not None,
    )
    return {
        "ok": True,
        "family_needs": family_needs,
        "matching_result": matching,
        "cluster_center": cluster_center,
        "warnings": warnings,
    }


@mcp.tool()
async def search_nearby_amenities(
    query_text: str,
    table_name: str,
    center_lat: float,
    center_lng: float,
    radius_km: float = 2.0,
) -> dict[str, Any]:
    """
    Embed query_text, run cosine-distance vector search on a whitelisted table,
    and return the top 5 rows whose location is within radius_km of the center.

    Args:
        query_text: Natural language query for embedding similarity.
        table_name: One of the CityStrata asset tables (see registry).
        center_lat / center_lng: Search center (WGS84).
        radius_km: Radius in kilometers (default 2.0).
    """
    logger.info(
        "Tool search_nearby_amenities start table=%s radius_km=%s",
        table_name,
        radius_km,
    )
    _dbg(f"search_nearby_amenities: START table={table_name} radius_km={radius_km}")
    _mcp_stderr(
        f"[mcp] search_nearby_amenities: start table={table_name!r} "
        f"radius_km={radius_km} — embedding via OpenAI…"
    )
    spec = _resolve_table(table_name)
    if radius_km <= 0:
        raise ValueError("radius_km must be positive")

    t0 = time.monotonic()
    _dbg("search_nearby_amenities: calling OpenAI embed...")
    try:
        # Hard cap even if httpx misbehaves
        vec = await asyncio.wait_for(_embed_text(query_text), timeout=75.0)
    except asyncio.TimeoutError as e:
        _dbg("search_nearby_amenities: OpenAI TIMED OUT after 75s")
        logger.warning("OpenAI embedding timed out after 75s")
        raise RuntimeError(
            "OpenAI embedding timed out after 75s — check network, API key, or proxy."
        ) from e
    embed_ms = (time.monotonic() - t0) * 1000.0
    _dbg(f"search_nearby_amenities: OpenAI OK in {embed_ms:.0f}ms")
    logger.info(
        "search_nearby_amenities: OpenAI embedding done in %.0f ms", embed_ms
    )
    _mcp_stderr(
        f"[mcp] search_nearby_amenities: OpenAI OK ({embed_ms:.0f} ms) — Postgres spatial + vector…"
    )
    vec_lit = _vector_literal(vec)
    radius_m = float(radius_km) * 1000.0
    lat_min, lat_max, lng_min, lng_max = _approx_lat_lng_bounds(
        center_lat, center_lng, float(radius_km)
    )

    # Two-phase query: (1) spatial-only candidate PKs (GiST-friendly), (2) vector sort on ≤500 rows.
    # One nested SQL mixing vector ORDER BY with spatial filters often produces bad plans on remote DBs.
    geo_center_ph = "geography(ST_SetSRID(ST_MakePoint($2, $1), 4326))"
    bbox_clip_ph = """ST_MakeEnvelope(
            $2::double precision - (
                ($3::double precision / 1000.0) / (111.0 * cos(radians($1::double precision)))
            ) * 1.25,
            $1::double precision - (($3::double precision / 1000.0) / 111.0) * 1.25,
            $2::double precision + (
                ($3::double precision / 1000.0) / (111.0 * cos(radians($1::double precision)))
            ) * 1.25,
            $1::double precision + (($3::double precision / 1000.0) / 111.0) * 1.25,
            4326
        )"""

    # Cheap numeric prefilter on lat/lng columns (all registry tables have them) so the planner
    # does not evaluate geography casts / ST_DWithin on unrelated rows (major win on remote DBs).
    sql_candidates = f"""
        SELECT t.{spec.pk_column} AS pk
        FROM {spec.sql_name} t
        WHERE t.embedding IS NOT NULL
          AND t.location IS NOT NULL
          AND t.{spec.lat_col}::double precision BETWEEN $4::double precision AND $5::double precision
          AND t.{spec.lng_col}::double precision BETWEEN $6::double precision AND $7::double precision
          AND t.location && {bbox_clip_ph}
          AND ST_DWithin(
                t.location::geography,
                {geo_center_ph},
                $3::double precision
              )
        LIMIT 500
    """

    sql_rank = f"""
        SELECT
            t.{spec.pk_column}::text AS listing_id,
            {spec.label_sql} AS label,
            {spec.address_sql} AS address,
            (t.embedding <=> $1::vector) AS cosine_distance,
            ST_Distance(t.location::geography, geography(ST_SetSRID(ST_MakePoint($3, $2), 4326))) / 1000.0 AS distance_km
        FROM {spec.sql_name} t
        WHERE t.{spec.pk_column} = ANY($4::uuid[])
        ORDER BY t.embedding <=> $1::vector ASC
        LIMIT 5
    """

    _mcp_stderr(
        "[mcp] About to hit Postgres — if this is the last line you see, it's the DB query"
    )
    _dbg("search_nearby_amenities: calling _get_pool()...")
    pool = await _get_pool()
    _dbg("search_nearby_amenities: got pool, acquiring connection...")
    t1 = time.monotonic()
    async with pool.acquire() as conn:
        _dbg(
            "search_nearby_amenities: connection acquired, running SQL phase 1 (spatial candidates)..."
        )
        async with conn.transaction():
            id_rows = await conn.fetch(
                sql_candidates,
                center_lat,
                center_lng,
                radius_m,
                lat_min,
                lat_max,
                lng_min,
                lng_max,
            )
            pks = [r["pk"] for r in id_rows]
            _dbg(
                f"search_nearby_amenities: SQL phase 1 done — {len(pks)} candidates "
                f"in {(time.monotonic() - t1) * 1000.0:.0f}ms"
            )
            logger.info(
                "search_nearby_amenities: spatial candidates=%s (table=%s)",
                len(pks),
                spec.sql_name,
            )
            if not pks:
                rows = []
            else:
                _dbg("search_nearby_amenities: running SQL phase 2 (vector rank)...")
                rows = await conn.fetch(
                    sql_rank,
                    vec_lit,
                    center_lat,
                    center_lng,
                    pks,
                )
                _dbg(
                    f"search_nearby_amenities: SQL phase 2 done — {len(rows)} rows"
                )
    _dbg("search_nearby_amenities: DONE")
    query_ms = (time.monotonic() - t1) * 1000.0
    logger.info(
        "search_nearby_amenities: DB query done in %.0f ms (rows=%s)",
        query_ms,
        len(rows),
    )
    _mcp_stderr(
        f"[mcp] search_nearby_amenities: Postgres OK ({query_ms:.0f} ms, {len(rows)} row(s))."
    )
    results: list[dict[str, Any]] = []
    for r in rows:
        results.append(
            {
                "listing_id": r["listing_id"],
                "label": r["label"],
                "address": r["address"],
                "cosine_distance": float(r["cosine_distance"])
                if r["cosine_distance"] is not None
                else None,
                "distance_km": float(r["distance_km"])
                if r["distance_km"] is not None
                else None,
            }
        )

    logger.info(
        "Tool search_nearby_amenities done table=%s count=%s",
        spec.sql_name,
        len(results),
    )
    return {
        "ok": True,
        "table_name": spec.sql_name,
        "query_text": query_text,
        "center": {"lat": center_lat, "lng": center_lng},
        "radius_km": radius_km,
        "embedding_model": _EMBEDDING_MODEL,
        "results": results,
        "count": len(results),
    }


# Family profiles store essential_education in Hebrew; educational_institutions.education_phase
# uses English phrases — map so ILIKE can match both.
_HEBREW_EDUCATION_TAG_TO_ENGLISH: dict[str, str] = {
    "גן ילדים": "kindergarten",
    "בית ספר יסודי": "elementary school",
    "חטיבה": "high school",
    "תיכון": "high school",
}


def _great_circle_distance_km(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Haversine distance in km (WGS84)."""
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return 6371.0 * c


async def _fetch_cluster_center_lat_lng(
    conn: asyncpg.Connection, fam_uuid: UUID
) -> Optional[tuple[float, float]]:
    """Same cluster centroid as get_family_tactical_context (macro run + cluster #)."""
    row = await conn.fetchrow(
        """
        SELECT mr.run_id, mr.recommended_cluster_number
        FROM evacuee_family_profiles efp
        LEFT JOIN matching_results mr ON mr.id = efp.selected_matching_result_id
        WHERE efp.uuid = $1::uuid
        """,
        fam_uuid,
    )
    if (
        not row
        or row["run_id"] is None
        or row["recommended_cluster_number"] is None
    ):
        return None
    crow = await conn.fetchrow(
        """
        SELECT
            AVG(
                ST_Y(COALESCE(sa.centroid, ST_Centroid(sa.geom)))
            ) AS center_lat,
            AVG(
                ST_X(COALESCE(sa.centroid, ST_Centroid(sa.geom)))
            ) AS center_lng,
            COUNT(*)::int AS area_count
        FROM cluster_assignments ca
        JOIN statistical_areas sa
          ON sa.stat_2022 = ca.stat_2022
         AND sa.semel_yish = 2600
        WHERE ca.run_id = $1::uuid
          AND ca.cluster = $2
        """,
        UUID(str(row["run_id"])),
        int(row["recommended_cluster_number"]),
    )
    if (
        not crow
        or not crow["area_count"]
        or crow["center_lat"] is None
        or crow["center_lng"] is None
    ):
        return None
    return float(crow["center_lat"]), float(crow["center_lng"])


def _education_tag_search_patterns(tag: str) -> list[str]:
    """
    Return distinct substring patterns for SQL ILIKE: original tag plus DB English equivalent if known.
    Order: original first, then English (deduplicated).
    """
    t = tag.strip()
    if not t:
        return []
    patterns: list[str] = [t]
    en = _HEBREW_EDUCATION_TAG_TO_ENGLISH.get(t)
    if en and en not in patterns:
        patterns.append(en)
    # Preserve order, unique
    seen: set[str] = set()
    out: list[str] = []
    for p in patterns:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


async def _nearest_distance_km(
    conn: asyncpg.Connection,
    *,
    lat: float,
    lng: float,
    table_sql: str,
    lat_col: str,
    lng_col: str,
) -> Optional[float]:
    """Minimum great-circle distance (km) from point to any row in table."""
    q = f"""
        SELECT MIN(
            ST_Distance(
                geography(ST_SetSRID(ST_MakePoint(t.{lng_col}, t.{lat_col}), 4326)),
                geography(ST_SetSRID(ST_MakePoint($2, $1), 4326))
            ) / 1000.0
        ) AS km
        FROM {table_sql} t
    """
    row = await conn.fetchrow(q, lat, lng)
    if not row or row["km"] is None:
        return None
    return float(row["km"])


async def _count_schools_near(
    conn: asyncpg.Connection,
    *,
    lat: float,
    lng: float,
    radius_km: float,
    essential_education: list[str],
) -> tuple[int, int]:
    """
    Returns (all_schools_count, matching_tag_count) within radius.
    Matching uses case-insensitive substring match on education_phase or type_of_education
    for each essential_education tag, including the Hebrew profile text and its English
    education_phase equivalent (see _HEBREW_EDUCATION_TAG_TO_ENGLISH).
    """
    radius_m = radius_km * 1000.0
    tags = [t.strip() for t in essential_education if t and str(t).strip()]
    all_q = """
        SELECT COUNT(*)::int AS c
        FROM educational_institutions ei
        WHERE ST_DWithin(
            geography(ST_SetSRID(ST_MakePoint(ei.lon, ei.lat), 4326)),
            geography(ST_SetSRID(ST_MakePoint($2, $1), 4326)),
            $3::double precision
        )
    """
    total = await conn.fetchrow(all_q, lat, lng, radius_m)
    all_c = int(total["c"]) if total else 0

    if not tags:
        return all_c, all_c

    # Per family tag: OR together ILIKE on Hebrew + English DB terms (same tag slot).
    tag_groups: list[str] = []
    params: list[Any] = [lat, lng, radius_m]
    pi = 4
    for tag in tags:
        patterns = _education_tag_search_patterns(tag)
        if not patterns:
            continue
        inner_parts: list[str] = []
        for pat in patterns:
            inner_parts.append(
                f"(ei.education_phase ILIKE ${pi} OR ei.type_of_education ILIKE ${pi})"
            )
            params.append(f"%{pat}%")
            pi += 1
        tag_groups.append("(" + " OR ".join(inner_parts) + ")")

    if not tag_groups:
        return all_c, all_c

    tag_conditions = " OR ".join(tag_groups)

    match_q = f"""
        SELECT COUNT(*)::int AS c
        FROM educational_institutions ei
        WHERE ST_DWithin(
            geography(ST_SetSRID(ST_MakePoint(ei.lon, ei.lat), 4326)),
            geography(ST_SetSRID(ST_MakePoint($2, $1), 4326)),
            $3::double precision
        )
        AND ({tag_conditions})
    """
    matched = await conn.fetchrow(match_q, *params)
    match_c = int(matched["c"]) if matched else 0
    return all_c, match_c


@mcp.tool()
async def calculate_location_score(
    listing_id: str,
    listing_table: str,
    family_id: str,
) -> dict[str, Any]:
    """
    Score a specific listing against a family's tactical needs using nearby
    schools (educational_institutions), synagogues, and matnasim.

    School matching: family ``essential_education`` tags are often Hebrew (e.g. גן ילדים),
    while ``educational_institutions.education_phase`` stores English (e.g. kindergarten).
    The scorer ILIKE-matches each tag against both the Hebrew text and its mapped English
    phrase so counts align with the database.

    Synagogue/matnas bonuses use tight distance bands; listings farther than **1.5 km** from the
    macro **cluster center** incur **0.5** points penalty per additional km (capped with the
    final 0–10 score).

    Args:
        listing_id: Primary key of the listing row (uuid string for most tables).
        listing_table: Whitelisted table name (e.g. airbnb_listings).
        family_id: evacuee_family_profiles.uuid as string.
    """
    logger.info(
        "Tool calculate_location_score start table=%s listing_id=%s",
        listing_table,
        listing_id,
    )
    try:
        fam_uuid = UUID(str(family_id).strip())
    except ValueError as e:
        raise ValueError(f"family_id must be a valid UUID; got {family_id!r}") from e

    spec = _resolve_table(listing_table)
    pool = await _get_pool()

    clat: Optional[float] = None
    clng: Optional[float] = None
    geo_dist_km: Optional[float] = None

    async with pool.acquire() as conn:
        # Fetch listing coordinates (all whitelisted asset tables use UUID PKs)
        loc_sql = f"""
            SELECT {spec.lat_col} AS lat, {spec.lng_col} AS lng,
                   {spec.label_sql} AS label,
                   {spec.address_sql} AS address
            FROM {spec.sql_name} t
            WHERE t.{spec.pk_column} = $1::uuid
        """
        try:
            lid = UUID(str(listing_id).strip())
        except ValueError as e:
            raise ValueError(
                f"listing_id must be a UUID for table {spec.sql_name}"
            ) from e
        lrow = await conn.fetchrow(loc_sql, lid)

        if not lrow or lrow["lat"] is None or lrow["lng"] is None:
            return {
                "ok": False,
                "error": f"Listing not found or missing coordinates: "
                f"{listing_table}/{listing_id}",
            }

        lat, lng = float(lrow["lat"]), float(lrow["lng"])

        frow = await conn.fetchrow(
            """
            SELECT
                essential_education,
                education_proximity_importance,
                religious_affiliation,
                needs_synagogue,
                matnas_participation,
                needs_community_proximity,
                social_venues_importance
            FROM evacuee_family_profiles
            WHERE uuid = $1::uuid
            """,
            fam_uuid,
        )
        if not frow:
            return {
                "ok": False,
                "error": f"Family not found for uuid={family_id}",
            }

        edu_imp = int(frow["education_proximity_importance"] or 3)
        essential = list(frow["essential_education"] or [])
        religious = str(frow["religious_affiliation"] or "")
        needs_syn = bool(frow["needs_synagogue"])
        matnas_part = bool(frow["matnas_participation"])
        needs_comm = bool(frow["needs_community_proximity"])
        social_imp = int(frow["social_venues_importance"] or 3)

        radius_edu = 2.0 if edu_imp >= 4 else 1.5
        all_schools, match_schools = await _count_schools_near(
            conn,
            lat=lat,
            lng=lng,
            radius_km=radius_edu,
            essential_education=essential,
        )

        syn_km = await _nearest_distance_km(
            conn,
            lat=lat,
            lng=lng,
            table_sql="synagogues",
            lat_col="location_lat",
            lng_col="location_lng",
        )
        mat_km = await _nearest_distance_km(
            conn,
            lat=lat,
            lng=lng,
            table_sql="matnasim",
            lat_col="location_lat",
            lng_col="location_lng",
        )

        cluster_xy = await _fetch_cluster_center_lat_lng(conn, fam_uuid)
        if cluster_xy:
            clat, clng = cluster_xy
            geo_dist_km = _great_circle_distance_km(lat, lng, clat, clng)

    # Heuristic 0–10 score (transparent, adjustable)
    score = 5.0
    breakdown: list[str] = []

    weight_edu = 0.15 * max(1, edu_imp)
    if essential:
        if match_schools > 0:
            add = min(3.0, weight_edu * match_schools)
            score += add
            breakdown.append(
                f"Education: +{add:.2f} ({match_schools} phase/type matches within {radius_edu}km "
                f"(Hebrew essential_education + English education_phase); "
                f"{all_schools} schools total nearby)"
            )
        elif all_schools > 0:
            add = min(1.5, weight_edu * min(all_schools, 3))
            score += add
            breakdown.append(
                f"Education: +{add:.2f} ({all_schools} schools within {radius_edu}km, "
                f"no ILIKE match for essential tags vs education_phase/type "
                f"(including Hebrew↔English mappings)"
            )
        else:
            score -= 1.0
            breakdown.append(
                f"Education: -1.00 (no schools within {radius_edu}km; family listed essential phases)"
            )
    elif edu_imp >= 4:
        if all_schools > 0:
            add = min(2.0, 0.4 * min(all_schools, 5))
            score += add
            breakdown.append(f"Education: +{add:.2f} (high importance; {all_schools} schools nearby)")
        else:
            score -= 0.8
            breakdown.append("Education: -0.80 (high importance but no schools in radius)")

    synagogue_relevant = needs_syn or religious in {"religious", "haredi", "traditional"}
    if synagogue_relevant:
        if syn_km is not None:
            if syn_km <= 0.2:
                score += 1.8
                breakdown.append(
                    f"Synagogue: +1.80 (nearest ~{syn_km:.2f}km, ≤200m tier)"
                )
            elif syn_km <= 0.8:
                score += 1.0
                breakdown.append(
                    f"Synagogue: +1.00 (nearest ~{syn_km:.2f}km, 200m–800m tier)"
                )
            elif syn_km <= 3.0:
                score += 0.3
                breakdown.append(f"Synagogue: +0.30 (nearest ~{syn_km:.2f}km)")
            else:
                score -= 0.8
                breakdown.append(f"Synagogue: -0.80 (nearest ~{syn_km:.2f}km)")
        else:
            score -= 1.0
            breakdown.append("Synagogue: -1.00 (no synagogues in database or query failed)")

    community_relevant = matnas_part or needs_comm or social_imp >= 4
    if community_relevant:
        if mat_km is not None:
            if mat_km <= 0.5:
                score += 1.5
                breakdown.append(
                    f"Matnas: +1.50 (nearest ~{mat_km:.2f}km, ≤500m tier)"
                )
            elif mat_km <= 1.5:
                score += 0.7
                breakdown.append(
                    f"Matnas: +0.70 (nearest ~{mat_km:.2f}km, 500m–1.5km tier)"
                )
            else:
                score -= 0.4
                breakdown.append(f"Matnas: -0.40 (nearest ~{mat_km:.2f}km)")
        else:
            score -= 0.5
            breakdown.append("Matnas: -0.50 (no matnasim reachable)")

    cluster_penalty = 0.0
    if geo_dist_km is not None:
        if geo_dist_km > 1.5:
            cluster_penalty = 0.5 * (geo_dist_km - 1.5)
            score -= cluster_penalty
            breakdown.append(
                f"Cluster center: -{cluster_penalty:.2f} "
                f"({geo_dist_km:.2f}km from strategic centroid; 0.5 pts per km beyond 1.5km)"
            )
        else:
            breakdown.append(
                f"Cluster center: no penalty ({geo_dist_km:.2f}km from strategic centroid, ≤1.5km)"
            )
    else:
        breakdown.append(
            "Cluster center: no distance penalty (macro centroid unavailable for this profile)"
        )

    score = max(0.0, min(10.0, score))
    score_rounded = round(score, 1)

    summary = (
        f"Listing '{lrow['label'] or listing_id}' in {spec.sql_name} scores {score_rounded}/10 for "
        f"family {family_id}. Key drivers: "
        + ("; ".join(breakdown) if breakdown else "baseline only")
    )

    logger.info(
        "Tool calculate_location_score done score=%s listing=%s",
        score_rounded,
        listing_id,
    )
    return {
        "ok": True,
        "score_out_of_10": score_rounded,
        "summary": summary,
        "listing": {
            "table": spec.sql_name,
            "listing_id": str(listing_id),
            "label": lrow["label"],
            "address": lrow["address"],
            "lat": lat,
            "lng": lng,
        },
        "family_uuid": str(fam_uuid),
        "metrics": {
            "schools_radius_km": radius_edu,
            "schools_total_nearby": all_schools,
            "schools_tag_matches_nearby": match_schools,
            "nearest_synagogue_km": syn_km,
            "nearest_matnas_km": mat_km,
            "distance_km_from_cluster_center": geo_dist_km,
            "cluster_center_penalty_points": round(cluster_penalty, 1),
            "cluster_center_lat": clat,
            "cluster_center_lng": clng,
        },
        "breakdown": breakdown,
    }


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
