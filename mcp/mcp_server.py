"""
CityStrata Tactical MCP Server — Holistic Radius-Based Evacuee Relocation
==========================================================================

Exposes three FastMCP tools that transform a family's pre-assigned statistical
cluster into concrete "relocation radii" (service-hub zones), ranked by spatial
density and pgvector semantic similarity across ALL meaningful amenity categories.

Architecture overview
---------------------
No distinction is made between "anchor" amenities (schools, synagogues) and
"secondary" amenities (cafes, parks, supermarkets).  Every table in
AMENITY_TABLES contributes equally to:
    1. K-means hub discovery  (PostGIS ST_ClusterKMeans within cluster polygon)
    2. Adaptive radius sizing (P75 distance to all nearby amenities)
    3. Semantic zone scoring  (pgvector cosine similarity, all embeddings pooled)

Data quality fixes (derived from Pydantic model inspection)
-----------------------------------------------------------
educational_institutions:
    The table stores one row per education programme, not per building.
    A single school (institution_code) may appear multiple times with different
    education_phase / type_of_education values.  All queries deduplicate by
    institution_code so counts represent physical school buildings.

coffee_shops / restaurants:
    Both tables carry permanently_closed and temporarily_closed boolean columns.
    Closed venues are excluded from all spatial and semantic queries via
    extra_filter so they do not distort hub positions or amenity counts.

OSM filtering
-------------
osm_city_facilities is a large catch-all table.  A curated whitelist
(OSM_FACILITY_WHITELIST) keeps only facility types that meaningfully affect a
displaced family's day-to-day quality of life.  See the whitelist comment block
for the full exclusion rationale.

Extensibility
-------------
To add a new amenity source:  append one entry to AMENITY_TABLES.
To update the OSM filter:     edit OSM_FACILITY_WHITELIST.
To deduplicate a table:       set dedup_col to the unique business-key column.
To filter a table:            set extra_filter to a valid SQL AND fragment.
No other code changes are required for any of the above.

Transport:  stdio (Cursor / Claude Desktop MCP protocol).
Environment variables:
    DATABASE_URL   — AsyncPG-compatible PostgreSQL URL (PostGIS + pgvector)
    OPENAI_API_KEY — OpenAI API key for text-embedding-3-small
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import asyncpg
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP


# ─── Logging ──────────────────────────────────────────────────────────────────
# MCP communicates over stdout (JSON-RPC).  All log output must go to stderr
# only — writing anything else to stdout corrupts the MCP transport.

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stderr,
    force=True,
)
logger = logging.getLogger("citystrata_mcp")


# ─── Environment ──────────────────────────────────────────────────────────────

def _load_env() -> None:
    """
    Load environment variables from a .env file.

    Search order: mcp/.env → project root .env → current working directory .env.
    The first file found wins; subsequent candidates are ignored.
    Falls back to load_dotenv() with no path if no .env file is found anywhere.
    """
    here = Path(__file__).resolve().parent
    for candidate in [here / ".env", here.parent / ".env", Path.cwd() / ".env"]:
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            logger.info("Loaded environment from %s", candidate)
            return
    load_dotenv(override=False)


_load_env()


def _require_env(name: str) -> str:
    """
    Return the value of a required environment variable.

    Args:
        name: Environment variable name.

    Returns:
        Stripped string value.

    Raises:
        RuntimeError: If the variable is absent or blank.
    """
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Required environment variable {name!r} is not set. "
            "Add it to .env or the MCP server env block in Cursor."
        )
    return value


# ─── Database pool ────────────────────────────────────────────────────────────

_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()


async def _get_pool() -> asyncpg.Pool:
    """
    Return the shared asyncpg connection pool, creating it on first call.

    The pool is initialised lazily and protected by an asyncio.Lock so that
    concurrent first-calls don't race.  Subsequent calls return the cached pool
    immediately.

    Pool settings:
        min_size=1, max_size=5   — small footprint; server is single-family
        command_timeout=120      — guards against runaway queries
        statement_cache_size=0   — required for PgBouncer compatibility
        statement_timeout=120s   — set at connection startup so it survives
                                   PgBouncer transaction-mode pooling

    Returns:
        The live asyncpg.Pool instance.
    """
    global _pool
    async with _pool_lock:
        if _pool is None:
            _pool = await asyncpg.create_pool(
                dsn=_require_env("DATABASE_URL"),
                min_size=1,
                max_size=5,
                command_timeout=120,
                statement_cache_size=0,
                server_settings={"statement_timeout": "120s"},
            )
            logger.info("asyncpg pool created.")
    return _pool


# ─── Embeddings ───────────────────────────────────────────────────────────────
# We intentionally use stdlib urllib instead of httpx or the openai SDK.
#
# On Windows, the MCP server runs as a child process with its stdout piped to
# the parent (Claude Desktop / Cursor).  When httpx uses the ProactorEventLoop
# and its connection pool, writes to the piped stdout can deadlock if the pipe
# buffer fills.  Using plain urllib.request in a thread executor avoids this
# entirely.  Do not reintroduce httpx or the openai SDK in this file.

def _embed_sync(text: str) -> list[float]:
    """
    Perform a synchronous OpenAI text-embedding-3-small call via stdlib urllib.

    Always called from a thread-pool executor (see _embed), never directly
    from the asyncio event loop.

    Args:
        text: The text to embed.

    Returns:
        A list of 1536 floats representing the embedding vector.

    Raises:
        RuntimeError: On HTTP errors from the OpenAI API.
    """
    payload = json.dumps({"model": "text-embedding-3-small", "input": text}).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {_require_env('OPENAI_API_KEY')}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read())["data"][0]["embedding"]
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI embeddings HTTP {exc.code}: {body[:400]}") from exc


async def _embed(text: str) -> list[float]:
    """
    Asynchronous wrapper around _embed_sync.

    Offloads the blocking HTTP call to the default thread-pool executor so the
    asyncio event loop remains responsive.  A hard 90-second timeout guards
    against silent network hangs.

    Args:
        text: The text to embed.

    Returns:
        A list of 1536 floats representing the embedding vector.
    """
    loop = asyncio.get_running_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _embed_sync, text),
        timeout=90.0,
    )


# ─── OSM facility whitelist ───────────────────────────────────────────────────
# osm_city_facilities is a large OSM catch-all table (~1 150 rows for Eilat).
# Raw, it is dominated by infrastructure noise: bus stops (259), parking (176),
# swimming pools (84), pitch (61), etc.
#
# This whitelist keeps only facility_type values that meaningfully affect a
# displaced family's daily quality of life.
#
# Exclusion rationale:
#   transport infrastructure : bus_stop (259), bus_station, parking (176),
#       fuel, charging_station, bicycle  → don't affect liveability decisions
#   leisure (high volume, low daily relevance): swimming_pool (84), pitch (61)
#       → distort K-means; not a housing selection factor
#   retail / personal services : clothes, shoes, hairdresser, electronics,
#       mobile_phone, hardware, electrical, jewelry, optician, florist,
#       computer, gift, baby_goods, bureau_de_change, kiosk, variety_store
#   tourism / entertainment : marina, bird_hide, scuba_diving, ice_rink,
#       water_park, beach_resort, tattoo, erotic, massage, outdoor, track,
#       deli, bakery (covered by restaurants table), bar, pub, alcohol
#   miscellaneous / bad data : yes, recycling
#
# After filtering, effective OSM rows drop from ~1 150 to ~100–110, which is
# proportionate to other tables (schools ~15–20, synagogues 27, matnasim 7,
# cafes ~50, restaurants ~180).
#
# To update: edit this set only — AMENITY_TABLES picks it up automatically.

OSM_FACILITY_WHITELIST: frozenset[str] = frozenset({
    # Green space — daily-life anchors for families with young children
    "park", "playground", "garden", "dog_park", "recreation_ground",
    # Sports and fitness — relevant for youth and adults
    # pitch and swimming_pool excluded (high count, not a housing factor)
    "fitness_station", "sports_centre",
    # Essential daily commerce
    "supermarket", "convenience",
    # Medical access — critical during displacement
    "pharmacy", "hospital", "clinic",
    # Financial services
    "atm", "bank",
    # Civic and government services — displaced families deal with paperwork
    "government", "post_office", "townhall", "police",
    # Education and culture (supplementary to educational_institutions table)
    "school", "library", "arts_centre", "university", "college",
    # Practical household need for families without in-unit laundry
    "laundry",
})

# Pre-built SQL array literal — constructed once at module load.
# Used in the extra_filter for osm_city_facilities:
#   AND facility_type = ANY(ARRAY['arts_centre','atm',...])
_OSM_WHITELIST_SQL_LITERAL: str = (
    "ARRAY[" + ",".join(f"'{f}'" for f in sorted(OSM_FACILITY_WHITELIST)) + "]"
)


# ─── Amenity registry ─────────────────────────────────────────────────────────
# AMENITY_TABLES is the single source of truth for every amenity data source.
#
# Schema per entry:
#   table         — PostgreSQL table name (never interpolated from user input)
#   category      — Label used in amenity_counts output and SQL FILTER expressions
#   location      — Name of the PostGIS geography/geometry column
#   has_embedding — True if the table has an 'embedding' vector column
#   dedup_col     — Optional column name for DISTINCT ON deduplication.
#                   Use when a table has multiple rows per real-world entity
#                   (e.g. educational_institutions has one row per programme,
#                   not per building; dedup_col='institution_code' collapses
#                   them to one row per physical school).
#                   The SQL builders wrap the SELECT in DISTINCT ON (dedup_col)
#                   with a matching ORDER BY automatically.
#   extra_filter  — Optional SQL AND fragment appended to the WHERE clause
#                   (e.g. OSM whitelist, closed-venue exclusion).
#                   Must be valid SQL with no unbound parameters.
#
# Data quality notes derived from Pydantic model inspection:
#   educational_institutions : institution_code is the unique school identifier.
#       Multiple rows per code exist (different education_phase/type_of_education).
#       dedup_col='institution_code' ensures counts reflect physical buildings.
#   coffee_shops / restaurants : permanently_closed and temporarily_closed
#       boolean columns exist.  extra_filter excludes them from all queries.

AMENITY_TABLES: list[dict[str, Any]] = [
    {
        "table":        "educational_institutions",
        "category":     "education",
        "location":     "location",
        "has_embedding": True,
        # educational_institutions has multiple rows per physical building:
        # different kindergartens/programmes share the same address.
        # Diagnostic query confirmed: 65 rows → 36 distinct physical locations
        # at 3-decimal-place coordinate precision (≈111 m grid).
        # We dedup on ROUND(lat,3), ROUND(lon,3) so each building contributes
        # exactly one point to K-means and one count to the census.
        # Note: lat/lon are plain float columns (confirmed in Pydantic model),
        # not the PostGIS geometry column — safe to use directly in DISTINCT ON.
        "dedup_col":    "ROUND(lat::numeric, 3), ROUND(lon::numeric, 3)",
        "extra_filter": None,
    },
    {
        "table":        "synagogues",
        "category":     "synagogue",
        "location":     "location",
        "has_embedding": True,
        "dedup_col":    None,
        "extra_filter": None,
    },
    {
        "table":        "matnasim",
        "category":     "matnas",
        "location":     "location",
        "has_embedding": True,
        "dedup_col":    None,
        "extra_filter": None,
    },
    {
        "table":        "coffee_shops",
        "category":     "cafe",
        "location":     "location",
        "has_embedding": True,
        "dedup_col":    None,
        # Exclude venues that are no longer operating.
        # permanently_closed and temporarily_closed are boolean columns
        # confirmed in the CoffeeShopBase Pydantic model.
        "extra_filter": "AND permanently_closed = FALSE AND temporarily_closed = FALSE",
    },
    {
        "table":        "restaurants",
        "category":     "restaurant",
        "location":     "location",
        "has_embedding": True,
        "dedup_col":    None,
        # Same closure logic as coffee_shops — confirmed in RestaurantBase model.
        "extra_filter": "AND permanently_closed = FALSE AND temporarily_closed = FALSE",
    },
    {
        # OSM filtered to the curated whitelist.
        # Raw: ~1 150 rows.  After whitelist: ~100–110 rows.
        "table":        "osm_city_facilities",
        "category":     "city_facility",
        "location":     "location",
        "has_embedding": True,
        "dedup_col":    None,
        "extra_filter": f"AND facility_type = ANY({_OSM_WHITELIST_SQL_LITERAL})",
    },
]

# Ordered list of all category names — used to build COUNT FILTER expressions
# and to iterate over amenity_counts dicts consistently.
ALL_CATEGORIES: list[str] = [t["category"] for t in AMENITY_TABLES]

# ─── Education supervision mapping ────────────────────────────────────────────
# Maps a family's religious_affiliation value to the corresponding
# type_of_supervision label in educational_institutions.
#
# DB values confirmed by query:
#   State (106 rows), State Religious (19), Ultra-Orthodox (3)
#
# Mapping rationale:
#   secular     → State            (standard state-secular schools)
#   religious   → State Religious  (Mamlachti Dati — national-religious)
#   traditional → State Religious  (closest fit; traditional families use dati schools)
#   haredi      → Ultra-Orthodox   (independent haredi network)
#   None / other → no filter       (count all supervision types)
#
# Used in discover_optimal_radius and semantic_radius_scoring to:
#   1. Filter the K-means point cloud to relevant school buildings only
#   2. Report education_matched (schools the family can use) alongside
#      education_total (all schools) and education_special (special ed)

SUPERVISION_MAP: dict[str, str] = {
    "secular":     "State",
    "religious":   "State Religious",
    "traditional": "State Religious",
    "haredi":      "Ultra-Orthodox",
}

# Allowed supervision values (whitelist for SQL safety).
_VALID_SUPERVISION_VALUES: frozenset[str] = frozenset(SUPERVISION_MAP.values())


# ─── SQL fragment builders ────────────────────────────────────────────────────
# These three functions generate the UNION ALL blocks used in Tools 2 and 3.
# They read AMENITY_TABLES at call time, so any registry change is automatically
# reflected in all queries.
#
# Deduplication (when t["dedup_col"] is set):
#   DISTINCT ON (dedup_col) is injected inline into the SELECT, collapsing
#   multiple rows with the same business key to one representative row.
#   ORDER BY <dedup_col> is appended (required by PostgreSQL's DISTINCT ON).
#   No subquery wrapper is used — see _build_table_block docstring for rationale.
#
# Parameter conventions (positional, asyncpg style):
#   _sql_all_amenities_in_cluster : no extra params — uses cluster_boundary CTE
#   _sql_all_amenities_near_hub   : $1=hub_lat  $2=hub_lng  $3=radius_m
#   _sql_all_embeddings_near_hub  : $1=vec_lit  $2=hub_lat  $3=hub_lng  $4=radius_m


def _build_table_block(
    t: dict[str, Any],
    spatial_clause: str,
    select_cols: str,
    extra_filter_override: Optional[str] = None,
) -> str:
    """
    Build a single SELECT block for one amenity table entry.

    Handles two optional fields from AMENITY_TABLES:
        extra_filter — appended as an AND condition in the WHERE clause
        dedup_col    — adds DISTINCT ON (dedup_col) directly in the SELECT
                       to collapse multiple rows per business key into one.

    The optional extra_filter_override is merged with t["extra_filter"] so
    per-request filters (e.g. education supervision type) can be injected
    without modifying the shared AMENITY_TABLES registry.

    DISTINCT ON design note:
        We use DISTINCT ON inline (not a subquery wrapper) because the outer
        SELECT would otherwise re-evaluate raw column expressions against
        already-aliased subquery columns, which PostgreSQL rejects.
        DISTINCT ON requires ORDER BY to begin with the same column — we append
        ORDER BY <dedup_col> at the end of the statement.

    Args:
        t:                    One AMENITY_TABLES entry dict.
        spatial_clause:       Complete SQL spatial condition (no leading AND).
        select_cols:          SELECT list expressions.
        extra_filter_override: Optional extra AND fragment to merge with
                               t["extra_filter"] for this call only.

    Returns:
        A complete SQL SELECT block ready to join with UNION ALL.
    """
    # Merge the registry filter with the per-request override
    parts = [t["extra_filter"] or "", extra_filter_override or ""]
    combined = " ".join(p for p in parts if p).strip()
    extra    = f"\n          {combined}" if combined else ""
    distinct = f"DISTINCT ON ({t['dedup_col']}) " if t["dedup_col"] else ""
    order_by = f" ORDER BY {t['dedup_col']}" if t["dedup_col"] else ""

    sql = (
        f"SELECT {distinct}{select_cols} "
        f"FROM {t['table']} "
        f"WHERE {t['location']} IS NOT NULL"
        f"{extra} "
        f"AND {spatial_clause}"
        f"{order_by}"
    )

    # PostgreSQL requires ORDER BY inside a UNION ALL member to be parenthesised.
    # Wrap the block whenever ORDER BY is present so the UNION ALL stays valid.
    return f"({sql})" if order_by else sql


def _sql_all_amenities_in_cluster(
    table_filter_overrides: Optional[dict[str, str]] = None,
) -> str:
    """
    Build a UNION ALL selecting (category TEXT, geom GEOMETRY) for every amenity
    table, restricted to points that lie strictly inside the cluster polygon.

    Assumes a preceding CTE named 'cluster_boundary' exposing a 'geom' column.

    Args:
        table_filter_overrides: Optional dict mapping table_name → extra SQL AND
            fragment, merged per-table at build time.  Used to inject per-request
            filters (e.g. education supervision type) without mutating AMENITY_TABLES.

    Returns:
        A SQL string of UNION ALL blocks for embedding inside a CTE.
    """
    blocks: list[str] = []
    overrides = table_filter_overrides or {}
    for t in AMENITY_TABLES:
        select_cols    = f"'{t['category']}'::text AS category, {t['location']}::geometry AS geom"
        spatial_clause = f"ST_Within({t['location']}::geometry, (SELECT geom FROM cluster_boundary))"
        blocks.append(_build_table_block(t, spatial_clause, select_cols, overrides.get(t["table"])))
    return "\n        UNION ALL\n        ".join(blocks)


def _sql_all_amenities_near_hub(
    table_filter_overrides: Optional[dict[str, str]] = None,
) -> str:
    """
    Build a UNION ALL selecting (category TEXT, location GEOGRAPHY) for every
    amenity table, restricted to points within a given radius of a hub centre.

    Used in Tool 2 to count amenities per category and compute the P75 radius.

    Bound parameters:
        $1 — hub_lat   DOUBLE PRECISION
        $2 — hub_lng   DOUBLE PRECISION
        $3 — radius_m  DOUBLE PRECISION

    Args:
        table_filter_overrides: Optional per-table extra filter dict.

    Returns:
        A SQL string of UNION ALL blocks for embedding inside a subquery.
    """
    blocks: list[str] = []
    overrides = table_filter_overrides or {}
    for t in AMENITY_TABLES:
        select_cols    = f"'{t['category']}'::text AS category, {t['location']} AS location"
        spatial_clause = (
            f"ST_DWithin("
            f"{t['location']}::geography, "
            f"geography(ST_SetSRID(ST_MakePoint($2, $1), 4326)), $3)"
        )
        blocks.append(_build_table_block(t, spatial_clause, select_cols, overrides.get(t["table"])))
    return "\n        UNION ALL\n        ".join(blocks)


def _sql_all_embeddings_near_hub(
    table_filter_overrides: Optional[dict[str, str]] = None,
) -> str:
    """
    Build a UNION ALL selecting (embedding VECTOR) for every table with embeddings,
    restricted to points within a given radius of a hub centre.

    Used in Tool 3 to pool all amenity embeddings for cosine-distance ranking.
    Only tables where has_embedding=True are included.

    Bound parameters:
        $1 — vec_lit   TEXT  (family embedding JSON, cast ::vector in outer query)
        $2 — hub_lat   DOUBLE PRECISION
        $3 — hub_lng   DOUBLE PRECISION
        $4 — radius_m  DOUBLE PRECISION

    Args:
        table_filter_overrides: Optional per-table extra filter dict, e.g. to
            restrict educational_institutions to the family's supervision type.

    Returns:
        A SQL string of UNION ALL blocks for embedding inside a subquery.
    """
    blocks: list[str] = []
    overrides = table_filter_overrides or {}
    for t in AMENITY_TABLES:
        if not t["has_embedding"]:
            continue
        select_cols    = "embedding"
        spatial_clause = (
            f"ST_DWithin("
            f"{t['location']}::geography, "
            f"geography(ST_SetSRID(ST_MakePoint($3, $2), 4326)), $4)"
        )
        # Merge: embedding IS NOT NULL + registry extra_filter + per-request override
        emb_filter = "AND embedding IS NOT NULL"
        t_effective = {
            **t,
            "extra_filter": (
                emb_filter
                + (f" {t['extra_filter']}" if t["extra_filter"] else "")
            ),
        }
        blocks.append(_build_table_block(
            t_effective, spatial_clause, select_cols, overrides.get(t["table"])
        ))
    return "\n        UNION ALL\n        ".join(blocks)


def _sql_count_filters() -> str:
    """
    Build a comma-separated list of conditional COUNT expressions, one per
    amenity category.

    Example output (two categories):
        COUNT(*) FILTER (WHERE category = 'education') AS education,
        COUNT(*) FILTER (WHERE category = 'synagogue') AS synagogue

    Used inside the per-hub census query so each category is counted in a
    single SQL pass.

    Returns:
        A SQL fragment suitable for use in a SELECT list.
    """
    return ",\n        ".join(
        f"COUNT(*) FILTER (WHERE category = '{cat}') AS {cat}"
        for cat in ALL_CATEGORIES
    )


# ─── MCP application ──────────────────────────────────────────────────────────

mcp = FastMCP(
    "CityStrata Tactical",
    instructions=(
        "Holistic radius-based tactical relocation tools for CityStrata. "
        "Given a family profile and a pre-assigned statistical cluster, the tools "
        "identify optimal neighbourhood zones using PostGIS K-means clustering "
        "across ALL curated amenity categories (education, synagogues, matnasim, "
        "cafes, restaurants, parks, supermarkets, medical, civic) and rank them "
        "via pgvector semantic similarity against the family's holistic needs."
    ),
)


# ══════════════════════════════════════════════════════════════════════════════
# Tool 1 — get_evacuation_context
# ══════════════════════════════════════════════════════════════════════════════

@mcp.tool()
async def get_evacuation_context(family_id: str) -> dict[str, Any]:
    """
    Load a family's full evacuation profile and their pre-assigned cluster.

    Performs two database queries:
        1. Fetches the complete family profile from evacuee_family_profiles and
           joins the selected matching_result to identify the assigned cluster.
        2. Computes the cluster's geographic centre as the mean of the statistical
           area centroids for all areas assigned to that cluster in the ML run.

    The returned family_needs dict is structured into thematic groups:
        composition  — household size and age breakdown
        mobility     — car ownership and disability status
        education    — required school types and proximity importance
        religion     — affiliation and synagogue requirement
        community    — matnas participation and community proximity need
        lifestyle    — social venues importance and culture frequency
        medical      — medical proximity need and services importance
        housing      — accommodation preference and estimated stay duration
        notes        — free-form officer notes

    Args:
        family_id: evacuee_family_profiles.uuid as a string.

    Returns:
        dict with keys:
            ok           : bool
            family_needs : structured profile dict (see above)
            cluster      : dict | None — run_id, cluster_number, cluster_name,
                           center_lat, center_lng, area_count, confidence, reasoning
    """
    try:
        fid = UUID(family_id.strip())
    except ValueError:
        return {"ok": False, "error": f"Invalid UUID: {family_id!r}"}

    pool = await _get_pool()

    # ── Query 1: family profile + linked matching result ──────────────────
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                efp.uuid::text              AS family_uuid,
                efp.family_name,
                efp.total_people,
                efp.infants,   efp.preschool, efp.elementary,
                efp.youth,     efp.adults,    efp.seniors,
                efp.has_mobility_disability,
                efp.has_car,
                efp.essential_education,
                efp.education_proximity_importance,
                efp.religious_affiliation,
                efp.needs_synagogue,
                efp.matnas_participation,
                efp.needs_community_proximity,
                efp.social_venues_importance,
                efp.culture_frequency,
                efp.accommodation_preference,
                efp.estimated_stay_duration,
                efp.needs_medical_proximity,
                efp.services_importance,
                efp.notes,
                mr.id::text                AS matching_result_id,
                mr.recommended_cluster,
                mr.recommended_cluster_number,
                mr.run_id::text            AS run_id,
                mr.confidence,
                mr.reasoning
            FROM evacuee_family_profiles efp
            LEFT JOIN matching_results mr
                ON mr.id = efp.selected_matching_result_id
            WHERE efp.uuid = $1::uuid
            """,
            fid,
        )

    if not row:
        return {"ok": False, "error": f"No profile found for family_id={family_id!r}"}

    # ── Structured family profile ──────────────────────────────────────────
    family_needs: dict[str, Any] = {
        "family_uuid": row["family_uuid"],
        "family_name": row["family_name"],
        "composition": {
            "total_people": row["total_people"],
            "infants":      row["infants"],
            "preschool":    row["preschool"],
            "elementary":   row["elementary"],
            "youth":        row["youth"],
            "adults":       row["adults"],
            "seniors":      row["seniors"],
        },
        "mobility": {
            # has_car affects walkability signal in _build_needs_text.
            "has_car":                row["has_car"],
            "has_mobility_disability": row["has_mobility_disability"],
        },
        "education": {
            # essential_tags are Hebrew/English phase labels matched against
            # educational_institutions.education_phase in scoring.
            "essential_tags":       list(row["essential_education"] or []),
            "proximity_importance": row["education_proximity_importance"],
        },
        "religion": {
            "affiliation":     row["religious_affiliation"],
            "needs_synagogue": row["needs_synagogue"],
        },
        "community": {
            "matnas_participation":      row["matnas_participation"],
            "needs_community_proximity": row["needs_community_proximity"],
            "social_importance":         row["social_venues_importance"],
            "culture_frequency":         row["culture_frequency"],
        },
        "lifestyle": {
            # social_venues_importance >= 3 → infer cafe/restaurant interest
            # culture_frequency >= 3        → infer parks/city facility interest
            "social_venues_importance": row["social_venues_importance"],
            "culture_frequency":        row["culture_frequency"],
        },
        "medical": {
            "needs_medical_proximity": row["needs_medical_proximity"],
            "services_importance":     row["services_importance"],
        },
        "housing": {
            "preference":    row["accommodation_preference"],
            "stay_duration": row["estimated_stay_duration"],
        },
        "notes": row["notes"],
    }

    # ── Query 2: cluster geographic centre ────────────────────────────────
    # Computed as the mean of ST_Centroid(geom) across all statistical areas
    # assigned to this cluster.  semel_yish = 2600 is Eilat's municipality code.
    cluster: Optional[dict[str, Any]] = None

    if row["run_id"] and row["recommended_cluster_number"] is not None:
        async with pool.acquire() as conn:
            crow = await conn.fetchrow(
                """
                SELECT
                    AVG(ST_Y(COALESCE(sa.centroid, ST_Centroid(sa.geom)))) AS center_lat,
                    AVG(ST_X(COALESCE(sa.centroid, ST_Centroid(sa.geom)))) AS center_lng,
                    COUNT(*)::int                                           AS area_count
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

        cluster = {
            "run_id":         row["run_id"],
            "cluster_number": row["recommended_cluster_number"],
            "cluster_name":   row["recommended_cluster"],
            "center_lat":     float(crow["center_lat"]) if crow and crow["center_lat"] else None,
            "center_lng":     float(crow["center_lng"]) if crow and crow["center_lng"] else None,
            "area_count":     crow["area_count"] if crow else 0,
            "confidence":     row["confidence"],
            "reasoning":      row["reasoning"],
        }

    logger.info(
        "get_evacuation_context ok family=%s cluster_found=%s",
        fid, cluster is not None,
    )
    return {"ok": True, "family_needs": family_needs, "cluster": cluster}


# ══════════════════════════════════════════════════════════════════════════════
# Tool 2 — discover_optimal_radius
# ══════════════════════════════════════════════════════════════════════════════

@mcp.tool()
async def discover_optimal_radius(
    run_id: str,
    cluster_number: int,
    needs_tags: list[str],
    education_supervision: Optional[str] = None,
) -> dict[str, Any]:
    """
    Identify up to 3 spatially distinct relocation "service-hub" radii within
    the assigned cluster boundary.

    Algorithm
    ---------
    Phase 1 — K-means hub discovery (PostGIS):
        All amenity points from AMENITY_TABLES that lie inside the cluster polygon
        (ST_Within) are collected into a single point cloud.  When education_supervision
        is supplied, educational_institutions are pre-filtered to that supervision type
        so hubs are positioned closer to schools the family can actually use.
        coffee_shops / restaurants are filtered to open venues only.
        osm_city_facilities are filtered to the curated whitelist.
        ST_ClusterKMeans partitions the point cloud into k ≤ 3 groups.

    Phase 2 — Per-hub census and adaptive radius:
        Step A: compute P75 distance over a wide 1 500 m discovery window → radius_m
        Step B: count all amenities strictly within radius_m (counts match the map circle)
        Step C: query educational_institutions directly for:
                  education_matched — school buildings matching the family's supervision
                                      type (deduplicated by ROUND(lat,3), ROUND(lon,3))
                  education_special — special education school buildings nearby

    Args:
        run_id:               matching_results.run_id UUID string.
        cluster_number:       Integer cluster ID from the macro ML agent.
        needs_tags:           Holistic need tags (informational).
        education_supervision: Optional supervision type from SUPERVISION_MAP values:
                               "State", "State Religious", or "Ultra-Orthodox".
                               None → no education filter (counts all supervision types).

    Returns:
        dict with keys:
            ok    : bool
            radii : list of up to 3 hub dicts — hub_label, center_lat, center_lng,
                    radius_m, total_amenities, amenity_counts (ALL_CATEGORIES),
                    education_matched (int), education_special (int)
    """
    try:
        rid = UUID(run_id.strip())
    except ValueError:
        return {"ok": False, "error": f"Invalid run_id UUID: {run_id!r}"}

    # Validate supervision value against the whitelist to prevent SQL injection.
    # The agent derives this from SUPERVISION_MAP so unknown values indicate a bug.
    if education_supervision and education_supervision not in _VALID_SUPERVISION_VALUES:
        return {
            "ok": False,
            "error": (
                f"Invalid education_supervision={education_supervision!r}. "
                f"Allowed: {sorted(_VALID_SUPERVISION_VALUES)}"
            ),
        }

    # Build the per-request education filter.  When set, this filters
    # educational_institutions to the family's supervision type in Phase 1
    # (K-means) so hubs gravitate toward schools the family will use.
    edu_table_overrides: Optional[dict[str, str]] = None
    if education_supervision:
        edu_table_overrides = {
            "educational_institutions": f"AND type_of_supervision = '{education_supervision}'",
        }

    pool = await _get_pool()
    async with pool.acquire() as conn:

        # ── Phase 1: K-means hub discovery ────────────────────────────────
        # LEAST(3, n) guards against clusters with fewer than 3 amenity points
        # since ST_ClusterKMeans requires k ≤ number of input points.
        hub_rows = await conn.fetch(
            f"""
            WITH cluster_boundary AS (
                -- Dissolve all statistical area polygons for this cluster
                -- into a single boundary polygon used for ST_Within filtering.
                SELECT ST_Union(sa.geom) AS geom
                FROM cluster_assignments ca
                JOIN statistical_areas sa
                    ON sa.stat_2022 = ca.stat_2022
                   AND sa.semel_yish = 2600
                WHERE ca.run_id  = $1::uuid
                  AND ca.cluster = $2
            ),
            all_amenities AS (
                -- Collect all clean, deduplicated amenity points within the
                -- cluster polygon.  The supervision filter (if set) restricts
                -- educational_institutions to schools relevant to this family.
                {_sql_all_amenities_in_cluster(edu_table_overrides)}
            ),
            total AS (
                SELECT COUNT(*) AS n FROM all_amenities
            ),
            clustered AS (
                -- Assign a K-means cluster ID to every amenity point.
                SELECT
                    ST_ClusterKMeans(geom, LEAST(3, (SELECT n FROM total)::int))
                        OVER () AS cid,
                    geom
                FROM all_amenities
            )
            -- Hub centre = centroid of each K-means group.
            SELECT
                cid                                  AS cluster_id,
                ST_Y(ST_Centroid(ST_Collect(geom))) AS hub_lat,
                ST_X(ST_Centroid(ST_Collect(geom))) AS hub_lng,
                COUNT(*)                             AS amenity_count
            FROM clustered
            GROUP BY cid
            ORDER BY cid
            """,
            rid,
            cluster_number,
        )

        if not hub_rows:
            return {
                "ok": False,
                "error": (
                    f"No amenities found within cluster {cluster_number} "
                    f"(run_id={run_id}). "
                    "Check cluster boundary geometry and spatial index coverage."
                ),
            }

        logger.info(
            "discover_optimal_radius: K-means produced %d hub(s) for cluster=%s",
            len(hub_rows), cluster_number,
        )

        # ── Phase 2: per-hub radius + census ─────────────────────────────
        # Three-step process:
        #   Step A — compute adaptive radius (P75 over wide 1 500 m window)
        #   Step B — count ALL amenities strictly within that radius
        #   Step C — count education breakdown directly (matched + special ed)
        #
        # Steps A and B use the supervision-filtered SQL so all counts reflect
        # what is visible inside the circle drawn on the map.
        amenities_near_sql         = _sql_all_amenities_near_hub(edu_table_overrides)
        amenities_near_sql_unfiltered = _sql_all_amenities_near_hub()  # for P75 (stable)
        count_filters_sql          = _sql_count_filters()
        zone_labels                = ["zone_alpha", "zone_beta", "zone_gamma"]
        radii: list[dict[str, Any]] = []

        for i, hub in enumerate(hub_rows):
            hlat = float(hub["hub_lat"])
            hlng = float(hub["hub_lng"])

            # Step A: compute P75 over ALL amenities (unfiltered) for a stable radius.
            # Using all amenities here avoids the edge case where a haredi family has
            # only 3 Ultra-Orthodox schools in the cluster, giving a tiny P75 radius.
            p75_row = await conn.fetchrow(
                f"""
                SELECT COALESCE(
                    PERCENTILE_CONT(0.75) WITHIN GROUP (
                        ORDER BY ST_Distance(
                            location::geography,
                            geography(ST_SetSRID(ST_MakePoint($2, $1), 4326))
                        )
                    ),
                    500.0
                ) AS p75_dist_m
                FROM (
                    {amenities_near_sql_unfiltered}
                ) AS all_amenities
                """,
                hlat,    # $1
                hlng,    # $2
                1500.0,  # $3 — wide discovery window
            )
            radius_m = max(400.0, min(1_500.0, float(p75_row["p75_dist_m"] or 500.0)))

            # Step B: count amenities strictly within radius_m.
            # Uses the supervision-filtered SQL so education count reflects
            # schools this family can actually use.
            counts = await conn.fetchrow(
                f"""
                SELECT {count_filters_sql}
                FROM (
                    {amenities_near_sql}
                ) AS all_amenities
                """,
                hlat,     # $1
                hlng,     # $2
                radius_m, # $3 — exact radius, matches the map circle
            )

            amenity_counts  = {cat: int(counts[cat] or 0) for cat in ALL_CATEGORIES}
            total_amenities = sum(amenity_counts.values())

            # Step C: education breakdown — query educational_institutions directly
            # so we have access to type_of_supervision and type_of_education columns.
            # Deduplicated at 3dp coordinate precision (one count per building).
            if education_supervision:
                edu_row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(DISTINCT CONCAT(
                            ROUND(lat::numeric, 3)::text, ',',
                            ROUND(lon::numeric, 3)::text
                        )) FILTER (
                            WHERE type_of_supervision = $4
                        ) AS education_matched,
                        COUNT(DISTINCT CONCAT(
                            ROUND(lat::numeric, 3)::text, ',',
                            ROUND(lon::numeric, 3)::text
                        )) FILTER (
                            WHERE type_of_education = 'special education'
                        ) AS education_special
                    FROM educational_institutions
                    WHERE location IS NOT NULL
                      AND ST_DWithin(
                            location::geography,
                            geography(ST_SetSRID(ST_MakePoint($2, $1), 4326)),
                            $3
                          )
                    """,
                    hlat, hlng, radius_m, education_supervision,
                )
            else:
                # No supervision filter — matched = total deduplicated buildings
                edu_row = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(DISTINCT CONCAT(
                            ROUND(lat::numeric, 3)::text, ',',
                            ROUND(lon::numeric, 3)::text
                        )) AS education_matched,
                        COUNT(DISTINCT CONCAT(
                            ROUND(lat::numeric, 3)::text, ',',
                            ROUND(lon::numeric, 3)::text
                        )) FILTER (
                            WHERE type_of_education = 'special education'
                        ) AS education_special
                    FROM educational_institutions
                    WHERE location IS NOT NULL
                      AND ST_DWithin(
                            location::geography,
                            geography(ST_SetSRID(ST_MakePoint($2, $1), 4326)),
                            $3
                          )
                    """,
                    hlat, hlng, radius_m,
                )

            education_matched = int(edu_row["education_matched"] or 0)
            education_special = int(edu_row["education_special"] or 0)

            radii.append({
                "hub_label":          zone_labels[i] if i < len(zone_labels) else f"zone_{i}",
                "center_lat":         hlat,
                "center_lng":         hlng,
                "radius_m":           round(radius_m),
                "total_amenities":    total_amenities,
                "amenity_counts":     amenity_counts,
                # Education breakdown — these are physical building counts
                "education_matched":  education_matched,
                "education_special":  education_special,
                "education_supervision_filter": education_supervision,
            })

            logger.info(
                "Hub %s: lat=%.5f lng=%.5f radius_m=%d total=%d "
                "edu_matched=%d edu_special=%d",
                radii[-1]["hub_label"], hlat, hlng, round(radius_m),
                total_amenities, education_matched, education_special,
            )

    logger.info(
        "discover_optimal_radius ok cluster=%s radii_found=%d",
        cluster_number, len(radii),
    )
    return {"ok": True, "radii": radii}


# ══════════════════════════════════════════════════════════════════════════════
# Tool 3 — semantic_radius_scoring
# ══════════════════════════════════════════════════════════════════════════════

@mcp.tool()
async def semantic_radius_scoring(
    radii: list[dict[str, Any]],
    family_needs_text: str,
    education_supervision: Optional[str] = None,
) -> dict[str, Any]:
    """
    Rank candidate hub radii by semantic similarity to the family's holistic needs.

    Algorithm
    ---------
    1. Embed family_needs_text using text-embedding-3-small (single API call).
    2. For each hub, collect embeddings of ALL amenities within radius_m.
       When education_supervision is set, educational_institutions embeddings are
       filtered to the family's supervision type so semantically irrelevant schools
       do not dilute the score.
    3. Rank by cosine distance to the family vector and take the top-20.
    4. semantic_score = mean(1 - cosine_distance) over the top-20.

    Args:
        radii:                List of hub dicts from discover_optimal_radius.
        family_needs_text:    Rich free-text of the family's holistic needs.
        education_supervision: Optional supervision filter (same as Tool 2).

    Returns:
        dict with keys:
            ok           : bool
            ranked_radii : hub list sorted by semantic_score descending, enriched
                           with semantic_score (0–1) and embeddings_matched (int).
    """
    if not radii:
        return {"ok": False, "error": "radii list is empty."}

    # Build per-request education filter (same logic as discover_optimal_radius).
    edu_table_overrides: Optional[dict[str, str]] = None
    if education_supervision and education_supervision in _VALID_SUPERVISION_VALUES:
        edu_table_overrides = {
            "educational_institutions": f"AND type_of_supervision = '{education_supervision}'",
        }

    # Embed once; reuse the vector for all hub queries.
    logger.info("semantic_radius_scoring: embedding family needs text…")
    family_vec = await _embed(family_needs_text)
    # asyncpg passes as text; SQL casts ::vector
    vec_lit    = json.dumps(family_vec)

    embeddings_sql = _sql_all_embeddings_near_hub(edu_table_overrides)
    pool           = await _get_pool()
    scored: list[dict[str, Any]] = []

    for hub in radii:
        lat      = float(hub["center_lat"])
        lng      = float(hub["center_lng"])
        radius_m = float(hub["radius_m"])

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT 1.0 - (embedding <=> $1::vector) AS similarity
                FROM (
                    {embeddings_sql}
                ) AS all_amenities
                ORDER BY embedding <=> $1::vector ASC
                LIMIT 20
                """,
                vec_lit,   # $1 — family embedding
                lat,       # $2 — hub latitude
                lng,       # $3 — hub longitude
                radius_m,  # $4 — search radius in metres
            )

        similarities   = [float(r["similarity"]) for r in rows]
        semantic_score = (
            round(sum(similarities) / len(similarities), 4)
            if similarities else 0.0
        )

        scored.append({
            **hub,
            "semantic_score":     semantic_score,
            "embeddings_matched": len(similarities),
        })

        logger.info(
            "Scored hub %s: semantic_score=%.4f embeddings_matched=%d",
            hub.get("hub_label"), semantic_score, len(similarities),
        )

    scored.sort(key=lambda x: x["semantic_score"], reverse=True)

    logger.info("semantic_radius_scoring ok radii_scored=%d", len(scored))
    return {"ok": True, "ranked_radii": scored}


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    """Start the MCP server on stdio transport (Cursor / Claude Desktop)."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()