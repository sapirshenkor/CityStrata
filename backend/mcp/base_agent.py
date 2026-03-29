"""
CityStrata Tactical Agent — Base Infrastructure

Shared helpers, MCP connection boilerplate, education-phase mappings,
needs extraction, DB persistence, and report-formatting utilities used
by both FamilyTacticalAgent and MultiFamilyTacticalAgent.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any, Optional
from uuid import UUID as _UUID

import asyncpg
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)


# ─── Path helpers ─────────────────────────────────────────────────────────────


def _project_root() -> Path:
    """CityStrata repository root (parent of the backend/ folder)."""
    return Path(__file__).resolve().parent.parent.parent


def _default_server_path() -> Path:
    """mcp_server.py sits next to this file."""
    return Path(__file__).resolve().parent / "mcp_server.py"


# ─── Progress output ──────────────────────────────────────────────────────────


def _progress(msg: str) -> None:
    """Write a progress line to stderr (stdout is reserved for the final report)."""
    print(msg, file=sys.stderr, flush=True)


def _to_int(value: Any, default: int = 0) -> int:
    """
    Safely coerce a DB value to int.

    Postgres numeric columns returned via asyncpg are usually int/float, but
    some fields (e.g. culture_frequency stored as text) may arrive as strings.
    Returns `default` for None, empty string, or any unparseable value.
    """
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


# ─── Education phase mapping ──────────────────────────────────────────────────
# Maps raw `education_phase` DB values to canonical stage keys and human labels.
# The DB stores CBS-style English labels; Hebrew fallback keywords are included
# for robustness if the source data ever changes.

_PHASE_CANONICAL: dict[str, str] = {
    "pre-primary": "kindergarten",
    "preprimary": "kindergarten",
    "kindergarten": "kindergarten",
    "preschool": "kindergarten",
    "גן": "kindergarten",
    "קדם יסודי": "kindergarten",
    "קדם-יסודי": "kindergarten",
    "elementary": "elementary",
    "primary": "elementary",
    "יסודי": "elementary",
    "post-primary": "high_school",
    "postprimary": "high_school",
    "secondary": "high_school",
    "high school": "high_school",
    "על יסודי": "high_school",
    "על-יסודי": "high_school",
    "תיכון": "high_school",
    'חט"ב': "high_school",
    'חט"ע': "high_school",
}

_PHASE_LABELS: dict[str, str] = {
    "kindergarten": "Kindergartens",
    "elementary": "Elementary Schools",
    "high_school": "High Schools",
}

# Maps family composition keys → canonical education phase.
_CHILD_TO_PHASE: dict[str, str] = {
    "infants": "kindergarten",
    "preschool": "kindergarten",
    "elementary": "elementary",
    "youth": "high_school",
}


def _classify_phase(raw_phase: str) -> Optional[str]:
    """Map a raw education_phase DB string to a canonical stage key."""
    normalised = raw_phase.strip().lower()
    for keyword, canonical in _PHASE_CANONICAL.items():
        if keyword in normalised:
            return canonical
    return None


def _needed_education_phases(family_needs: dict[str, Any]) -> list[str]:
    """
    Return the canonical education phase keys the family actually needs,
    based on which child-age buckets have a non-zero count.
    """
    comp = family_needs.get("composition") or {}
    phases: list[str] = []
    for child_key, phase in _CHILD_TO_PHASE.items():
        if comp.get(child_key) and phase not in phases:
            phases.append(phase)
    return phases


def _aggregate_phase_counts(
    raw_phase_counts: dict[str, int],
) -> dict[str, int]:
    """
    Re-key a raw {education_phase: count} dict into canonical
    {kindergarten|elementary|high_school: count}, merging any DB-value
    synonyms into the same bucket.
    """
    agg: dict[str, int] = {}
    for raw_phase, cnt in raw_phase_counts.items():
        canonical = _classify_phase(raw_phase)
        if canonical:
            agg[canonical] = agg.get(canonical, 0) + cnt
    return agg


# ─── MCP response decoder ─────────────────────────────────────────────────────


def _decode(result: Any) -> dict[str, Any]:
    """
    Decode an MCP call_tool result into a plain dict.

    FastMCP may return structuredContent (a dict) or a list of text blocks
    containing JSON — both forms are handled here.
    """
    if getattr(result, "isError", False):
        raise RuntimeError(
            f"MCP tool error: {getattr(result, 'error', 'unknown error')}"
        )

    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured

    chunks: list[str] = []
    for block in getattr(result, "content", []) or []:
        btype = getattr(block, "type", None) or (
            block.get("type") if isinstance(block, dict) else None
        )
        text = getattr(block, "text", None) or (
            block.get("text") if isinstance(block, dict) else None
        )
        if btype == "text" and text:
            chunks.append(str(text))

    raw = "".join(chunks).strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {"value": data}
    except json.JSONDecodeError:
        return {"_raw_text": raw}


# ─── AI constants ─────────────────────────────────────────────────────────────

_AI_MODEL = "gpt-4o"
_AI_TIMEOUT = 65.0  # seconds


# ─── Holistic needs helpers ───────────────────────────────────────────────────


def _extract_needs_tags(family_needs: dict[str, Any]) -> list[str]:
    """
    Derive holistic amenity-type tags from the full family profile.

    Tags map 1-to-1 with AMENITY_TABLES categories in mcp_server.py.
    All detected needs are included; the fallback is every category so that
    hub discovery always has a complete amenity picture.
    """
    tags: list[str] = []

    edu = family_needs.get("education") or {}
    rel = family_needs.get("religion") or {}
    comm = family_needs.get("community") or {}
    lifestyle = family_needs.get("lifestyle") or {}
    medical = family_needs.get("medical") or {}

    # ── Anchor institutions ────────────────────────────────────────────────
    if edu.get("essential_tags") or _to_int(edu.get("proximity_importance")) >= 3:
        tags.append("education")

    if rel.get("needs_synagogue") or rel.get("affiliation") in (
        "religious",
        "haredi",
        "traditional",
    ):
        tags.append("synagogue")

    if comm.get("matnas_participation") or comm.get("needs_community_proximity"):
        tags.append("matnas")

    # ── Lifestyle / commercial ─────────────────────────────────────────────
    # social_venues_importance >= 3 signals interest in cafes and restaurants.
    social_imp = _to_int(
        lifestyle.get("social_venues_importance") or comm.get("social_importance")
    )
    if social_imp >= 3:
        tags.append("cafe")
        tags.append("restaurant")

    # culture_frequency >= 3 signals interest in city facilities (parks, etc.)
    culture_freq = _to_int(
        lifestyle.get("culture_frequency") or comm.get("culture_frequency")
    )
    if culture_freq >= 3:
        tags.append("city_facility")

    # ── Medical / services ────────────────────────────────────────────────
    if (
        medical.get("needs_medical_proximity")
        or _to_int(medical.get("services_importance")) >= 4
    ):
        tags.append("city_facility")  # OSM city facilities include clinics

    # Fallback: include every category so hub discovery is always holistic.
    if not tags:
        tags = [
            "education",
            "synagogue",
            "matnas",
            "cafe",
            "restaurant",
            "city_facility",
        ]

    return list(dict.fromkeys(tags))  # deduplicate while preserving order


def _resolve_education_supervision(family_needs: dict[str, Any]) -> Optional[str]:
    """
    Map the family's religious affiliation to the corresponding school
    supervision type in educational_institutions.type_of_supervision.

    DB values (confirmed): "State" (106), "State Religious" (19), "Ultra-Orthodox" (3).

    Returns:
        The DB supervision string to filter on, or None if affiliation is
        unknown/absent (no filter applied — all supervision types counted).
    """
    affiliation = (family_needs.get("religion") or {}).get("affiliation") or ""
    mapping = {
        "secular": "State",
        "religious": "State Religious",
        "traditional": "State Religious",
        "haredi": "Ultra-Orthodox",
    }
    return mapping.get(affiliation.lower())


def _build_needs_text(family_needs: dict[str, Any]) -> str:
    """
    Build a free-text description of the family's holistic needs for embedding.

    This text is the semantic query vector used in semantic_radius_scoring.
    The richer the description, the better pgvector can rank zones that match
    the family's full lifestyle — not just anchor institutions.
    """
    parts: list[str] = []

    comp = family_needs.get("composition") or {}
    edu = family_needs.get("education") or {}
    rel = family_needs.get("religion") or {}
    comm = family_needs.get("community") or {}
    lifestyle = family_needs.get("lifestyle") or {}
    medical = family_needs.get("medical") or {}
    mob = family_needs.get("mobility") or {}

    # ── Family composition ────────────────────────────────────────────────
    if comp.get("total_people"):
        parts.append(f"Family of {comp['total_people']} people")

    child_parts: list[str] = []
    if comp.get("infants"):
        child_parts.append(f"{comp['infants']} infant(s)")
    if comp.get("preschool"):
        child_parts.append(f"{comp['preschool']} preschool child(ren)")
    if comp.get("elementary"):
        child_parts.append(f"{comp['elementary']} elementary school child(ren)")
    if comp.get("youth"):
        child_parts.append(f"{comp['youth']} youth")
    if child_parts:
        parts.append("with " + ", ".join(child_parts))

    if comp.get("seniors"):
        parts.append(f"{comp['seniors']} senior(s) in household")

    # ── Education ─────────────────────────────────────────────────────────
    edu_tags = edu.get("essential_tags") or []
    if edu_tags:
        parts.append(f"education needs: {', '.join(edu_tags)}")
    elif _to_int(edu.get("proximity_importance")) >= 4:
        parts.append("high education proximity importance")

    # ── Religion ──────────────────────────────────────────────────────────
    if rel.get("affiliation"):
        parts.append(f"religious affiliation: {rel['affiliation']}")
    if rel.get("needs_synagogue"):
        parts.append("requires nearby synagogue for daily prayer")

    # ── Community ─────────────────────────────────────────────────────────
    if comm.get("matnas_participation"):
        parts.append("active matnas (community centre) participation")
    if comm.get("needs_community_proximity"):
        parts.append("needs strong community proximity and social integration")

    # ── Lifestyle: cafes, restaurants, city life ──────────────────────────
    social_imp = _to_int(
        lifestyle.get("social_venues_importance") or comm.get("social_importance")
    )
    if social_imp >= 4:
        parts.append("high interest in nearby cafes, restaurants, and social venues")
    elif social_imp >= 3:
        parts.append("appreciates access to cafes and dining options")

    culture_freq = _to_int(
        lifestyle.get("culture_frequency") or comm.get("culture_frequency")
    )
    if culture_freq >= 4:
        parts.append("frequent use of parks, city facilities, and cultural venues")
    elif culture_freq >= 3:
        parts.append("occasional use of parks and city amenities")

    # ── Medical / services ────────────────────────────────────────────────
    if medical.get("needs_medical_proximity"):
        parts.append("requires proximity to medical services and clinics")
    if _to_int(medical.get("services_importance")) >= 4:
        parts.append("high importance placed on access to health and city services")

    # ── Mobility ──────────────────────────────────────────────────────────
    if mob.get("has_mobility_disability"):
        parts.append(
            "household member with mobility disability — needs accessible area"
        )
    if not mob.get("has_car"):
        parts.append("no private car — walkable neighbourhood preferred")

    # ── Free-form notes ───────────────────────────────────────────────────
    notes = family_needs.get("notes")
    if notes:
        parts.append(notes)

    return (
        ". ".join(parts)
        or "Displaced Israeli family seeking holistic relocation in Eilat"
    )


# ─── DB persistence ───────────────────────────────────────────────────────────


async def save_family_response(
    family_uuid: str,
    agent_output: str,
    confidence: Optional[str] = None,
    radii_data: Optional[list] = None,
) -> None:
    """
    Upsert a tactical response for a single family into
    ``family_tactical_responses``.

    Uses INSERT … ON CONFLICT (profile_uuid) DO UPDATE so that re-running the
    pipeline for the same family replaces the previous report in-place.

    Non-fatal: any DB error is logged and swallowed so the caller always
    receives the report regardless of persistence failures.
    """
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        _progress("[tactical] DATABASE_URL not set — skipping family response save.")
        return

    radii_json = json.dumps(radii_data) if radii_data else None

    try:
        conn = await asyncpg.connect(dsn=db_url, statement_cache_size=0)
        try:
            await conn.execute(
                """
                INSERT INTO family_tactical_responses
                    (profile_uuid, agent_output, confidence, radii_data)
                VALUES ($1::uuid, $2, $3, $4::jsonb)
                ON CONFLICT (profile_uuid) DO UPDATE
                    SET agent_output = EXCLUDED.agent_output,
                        confidence   = EXCLUDED.confidence,
                        radii_data   = EXCLUDED.radii_data,
                        updated_at   = NOW()
                """,
                family_uuid,
                agent_output,
                confidence,
                radii_json,
            )
        finally:
            await conn.close()
        _progress("[tactical] Family response upserted to family_tactical_responses.")
    except Exception as exc:
        logger.warning("Family response save failed (non-fatal): %s", exc)
        _progress(f"[tactical] Family response save skipped ({exc}).")


async def save_multi_family_response(
    multi_family_uuid: str,
    agent_output: str,
    confidence: Optional[str] = None,
    radii_data: Optional[list] = None,
) -> None:
    """
    Upsert a tactical response for a multi-family group into
    ``multi_family_tactical_responses``.

    Uses INSERT … ON CONFLICT (multi_family_uuid) DO UPDATE so that re-running
    replaces the previous report in-place.

    Non-fatal: any DB error is logged and swallowed.
    """
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        _progress("[tactical] DATABASE_URL not set — skipping multi-family response save.")
        return

    radii_json = json.dumps(radii_data) if radii_data else None

    try:
        conn = await asyncpg.connect(dsn=db_url, statement_cache_size=0)
        try:
            await conn.execute(
                """
                INSERT INTO multi_family_tactical_responses
                    (multi_family_uuid, agent_output, confidence, radii_data)
                VALUES ($1::uuid, $2, $3, $4::jsonb)
                ON CONFLICT (multi_family_uuid) DO UPDATE
                    SET agent_output = EXCLUDED.agent_output,
                        confidence   = EXCLUDED.confidence,
                        radii_data   = EXCLUDED.radii_data,
                        updated_at   = NOW()
                """,
                multi_family_uuid,
                agent_output,
                confidence,
                radii_json,
            )
        finally:
            await conn.close()
        _progress(
            "[tactical] Multi-family response upserted to multi_family_tactical_responses."
        )
    except Exception as exc:
        logger.warning("Multi-family response save failed (non-fatal): %s", exc)
        _progress(f"[tactical] Multi-family response save skipped ({exc}).")


# ─── Multi-family profile helpers ─────────────────────────────────────────────


def _culture_rank(value: Any) -> int:
    """Rank culture_frequency for merge: daily > weekly > rarely."""
    s = (str(value or "")).strip().lower()
    if s == "daily":
        return 3
    if s == "weekly":
        return 2
    return 1


def _culture_from_rank(rank: int) -> str:
    if rank >= 3:
        return "daily"
    if rank == 2:
        return "weekly"
    return "rarely"


async def ensure_multi_family_profile(member_uuids: list[str]) -> str:
    """
    Ensure a ``multi_family_profiles`` row exists for the given source families.

    Idempotent: if a profile with the exact same ``member_family_uuids`` (sorted)
    already exists, its UUID is returned without inserting a new row.

    Aggregation rules (same as MCP get_community_context / tactical_pipeline):
        - Sums: total_people, age brackets
        - Any: has_mobility_disability, needs_synagogue, matnas_participation,
               needs_community_proximity, needs_medical_proximity
        - All: has_car
        - Max: education_proximity_importance, social_venues_importance,
               services_importance, culture_frequency (by rank)
        - Union: essential_education
        - Single / "other": religious_affiliation

    Returns:
        The multi-family profile UUID (str) — existing or newly created.

    Raises:
        RuntimeError: if DATABASE_URL is not set.
        ValueError: if any source profile is missing.
    """
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL not set — cannot create multi-family profile."
        )

    sorted_uuids = sorted(u.strip() for u in member_uuids)
    uuid_objs = [_UUID(u) for u in sorted_uuids]

    conn = await asyncpg.connect(dsn=db_url, statement_cache_size=0)
    try:
        existing = await conn.fetchrow(
            """
            SELECT uuid::text AS uuid
            FROM multi_family_profiles
            WHERE member_family_uuids = $1::uuid[]
            """,
            uuid_objs,
        )
        if existing:
            _progress(
                f"[tactical] Multi-family profile already exists: {existing['uuid']}"
            )
            return existing["uuid"]

        rows = await conn.fetch(
            """
            SELECT *
            FROM evacuee_family_profiles
            WHERE uuid = ANY($1::uuid[])
            """,
            uuid_objs,
        )

        if len(rows) != len(sorted_uuids):
            found = {str(r["uuid"]) for r in rows}
            missing = [u for u in sorted_uuids if u not in found]
            raise ValueError(f"Source profiles not found: {missing}")

        by_uuid = {str(r["uuid"]): r for r in rows}
        ordered = [by_uuid[u] for u in sorted_uuids]
        first = ordered[0]

        names = [r["family_name"] for r in ordered]
        family_name = "Multi-Family: " + " & ".join(names)

        total_people = sum(int(r["total_people"] or 0) for r in ordered)
        infants = sum(int(r["infants"] or 0) for r in ordered)
        preschool = sum(int(r["preschool"] or 0) for r in ordered)
        elementary = sum(int(r["elementary"] or 0) for r in ordered)
        youth = sum(int(r["youth"] or 0) for r in ordered)
        adults = sum(int(r["adults"] or 0) for r in ordered)
        seniors = sum(int(r["seniors"] or 0) for r in ordered)

        has_mobility = any(bool(r["has_mobility_disability"]) for r in ordered)
        has_car_all = all(bool(r["has_car"]) for r in ordered)

        edu_imp = max(int(r["education_proximity_importance"] or 0) for r in ordered)
        social_imp = max(int(r["social_venues_importance"] or 0) for r in ordered)
        services_imp = max(int(r["services_importance"] or 0) for r in ordered)

        essential_union: list[str] = []
        seen_e: set[str] = set()
        for r in ordered:
            for tag in list(r["essential_education"] or []):
                t = str(tag).strip()
                if t and t not in seen_e:
                    seen_e.add(t)
                    essential_union.append(t)

        affil_set = {
            str(r["religious_affiliation"] or "").strip()
            for r in ordered
            if str(r["religious_affiliation"] or "").strip()
        }
        merged_affiliation = (
            next(iter(affil_set)) if len(affil_set) == 1 else "other"
        )

        cr = max(_culture_rank(r["culture_frequency"]) for r in ordered)
        culture_frequency = _culture_from_rank(cr)

        notes_parts = [
            f"[{r['family_name']}] {r['notes']}"
            for r in ordered
            if (r["notes"] or "").strip()
        ]
        merger_line = (
            "[Multi-Family merged profile — sources: "
            + ", ".join(sorted_uuids)
            + "]"
        )
        merged_notes = merger_line
        if notes_parts:
            merged_notes = merger_line + "\n" + " | ".join(notes_parts)

        matching_id = first.get("selected_matching_result_id")

        new_row = await conn.fetchrow(
            """
            INSERT INTO multi_family_profiles (
                member_family_uuids,
                family_name, contact_name, contact_phone, contact_email,
                home_stat_2022, city_name, home_address,
                total_people, infants, preschool, elementary, youth, adults, seniors,
                has_mobility_disability, has_car,
                essential_education, education_proximity_importance,
                religious_affiliation, needs_synagogue, culture_frequency,
                matnas_participation, social_venues_importance, needs_community_proximity,
                accommodation_preference, estimated_stay_duration,
                needs_medical_proximity, services_importance, notes,
                selected_matching_result_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                $27, $28, $29, $30, $31
            )
            RETURNING uuid::text AS uuid
            """,
            uuid_objs,                                              # $1
            family_name,                                            # $2
            first.get("contact_name"),                              # $3
            first.get("contact_phone"),                             # $4
            first.get("contact_email"),                             # $5
            first.get("home_stat_2022"),                            # $6
            first.get("city_name"),                                 # $7
            first.get("home_address"),                              # $8
            total_people,                                           # $9
            infants,                                                # $10
            preschool,                                              # $11
            elementary,                                             # $12
            youth,                                                  # $13
            adults,                                                 # $14
            seniors,                                                # $15
            has_mobility,                                           # $16
            has_car_all,                                            # $17
            essential_union,                                        # $18
            edu_imp,                                                # $19
            merged_affiliation,                                     # $20
            any(bool(r["needs_synagogue"]) for r in ordered),       # $21
            culture_frequency,                                      # $22
            any(bool(r["matnas_participation"]) for r in ordered),  # $23
            social_imp,                                             # $24
            any(                                                    # $25
                bool(r["needs_community_proximity"]) for r in ordered
            ),
            first.get("accommodation_preference", "airbnb"),        # $26
            first.get("estimated_stay_duration"),                    # $27
            any(                                                    # $28
                bool(r["needs_medical_proximity"]) for r in ordered
            ),
            services_imp,                                           # $29
            merged_notes,                                           # $30
            matching_id,                                            # $31
        )

        mf_uuid = new_row["uuid"]
        _progress(f"[tactical] Multi-family profile created: {mf_uuid}")
        return mf_uuid
    finally:
        await conn.close()


# ─── Report formatting helpers ────────────────────────────────────────────────


def _relevant_categories(family_needs: dict[str, Any]) -> set[str]:
    """
    Determine which amenity categories are relevant to this family's profile.

    Returns a set of category keys (matching AMENITY_TABLES) plus the
    pseudo-key "education_special" when special-education schools should be
    mentioned.  The static report and the AI prompt both use this to avoid
    surfacing amenities the family never asked for.
    """
    relevant: set[str] = set()

    comp = family_needs.get("composition") or {}
    edu = family_needs.get("education") or {}
    rel = family_needs.get("religion") or {}
    comm = family_needs.get("community") or {}
    mob = family_needs.get("mobility") or {}
    lifestyle = family_needs.get("lifestyle") or {}
    medical = family_needs.get("medical") or {}
    notes = (family_needs.get("notes") or "").lower()

    has_children = any(
        comp.get(k) for k in ("infants", "preschool", "elementary", "youth")
    )
    if (
        has_children
        or edu.get("essential_tags")
        or _to_int(edu.get("proximity_importance")) >= 3
    ):
        relevant.add("education")

    if (
        mob.get("has_mobility_disability")
        or "חינוך מיוחד" in notes
        or "special" in notes
    ):
        relevant.add("education_special")

    if rel.get("needs_synagogue") or rel.get("affiliation") in (
        "religious",
        "haredi",
        "traditional",
    ):
        relevant.add("synagogue")

    if comm.get("matnas_participation") or comm.get("needs_community_proximity"):
        relevant.add("matnas")

    social_imp = _to_int(
        lifestyle.get("social_venues_importance") or comm.get("social_importance")
    )
    if social_imp >= 3:
        relevant.add("cafe")
        relevant.add("restaurant")

    culture_freq = _to_int(
        lifestyle.get("culture_frequency") or comm.get("culture_frequency")
    )
    if culture_freq >= 3:
        relevant.add("city_facility")

    if (
        medical.get("needs_medical_proximity")
        or _to_int(medical.get("services_importance")) >= 4
    ):
        relevant.add("city_facility")

    return relevant


# Hebrew translations for the fixed zone hub labels produced by the pipeline.
_HUB_LABEL_HE: dict[str, str] = {
    "zone_alpha": "אזור אלפא",
    "zone_beta": "אזור בטא",
    "zone_gamma": "אזור גמא",
}

# Hebrew labels for the education phase keys (parallel to _PHASE_LABELS in English).
_PHASE_LABELS_HE: dict[str, str] = {
    "kindergarten": "גני ילדים",
    "elementary": "בתי ספר יסודיים",
    "high_school": "בתי ספר תיכוניים",
}


def _he_zone_label(hub_label: str) -> str:
    """
    Return the Hebrew-friendly zone name for a hub_label string.

    Known labels (zone_alpha/beta/gamma) map to Hebrew letter names.
    Any other pattern falls back to "אזור <N>" where N is the numeric index
    extracted from the label, or the raw label if no number is present.
    """
    raw = (hub_label or "").strip().lower()
    if raw in _HUB_LABEL_HE:
        return _HUB_LABEL_HE[raw]
    # Generic fallback: replace "zone" with "אזור", capitalise remainder.
    return raw.replace("zone_", "אזור ").replace("zone ", "אזור ").strip().title()


# ─── Base Agent ───────────────────────────────────────────────────────────────


class BaseTacticalAgent:
    """
    Shared MCP connection boilerplate for all tactical agents.

    Handles initialisation (paths, environment, OpenAI client setup),
    ``AsyncExitStack`` and MCP ``stdio_client`` connection lifecycle, and
    the common ``_call`` tool-invocation wrapper.

    Subclasses implement ``run()`` with their specific pipeline logic.

    Usage::

        async with SomeAgent() as agent:
            result = await agent.run(...)
    """

    def __init__(
        self,
        mcp_server_script: Optional[Path] = None,
        tool_timeout_s: float = 240.0,
        forward_server_stderr: bool = False,
    ) -> None:
        self._server_path = (mcp_server_script or _default_server_path()).resolve()
        if not self._server_path.is_file():
            raise FileNotFoundError(f"MCP server script not found: {self._server_path}")

        self.tool_timeout_s = tool_timeout_s
        # Discard server stderr by default — piping it on Windows can deadlock MCP stdio.
        self._errlog = (
            sys.stderr
            if forward_server_stderr
            else open(os.devnull, "w", encoding="utf-8")
        )
        self._stack: Optional[AsyncExitStack] = None
        self._session: Optional[ClientSession] = None

    # ── Context manager ───────────────────────────────────────────────────

    async def __aenter__(self) -> BaseTacticalAgent:
        self._stack = AsyncExitStack()
        params = StdioServerParameters(
            command=sys.executable,
            args=[str(self._server_path)],
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
            cwd=str(_project_root()),
        )
        read, write = await self._stack.enter_async_context(
            stdio_client(params, errlog=self._errlog)
        )
        self._session = await self._stack.enter_async_context(
            ClientSession(read, write)
        )
        await self._session.initialize()
        _progress(f"[tactical] Connected to MCP server: {self._server_path.name}")
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._stack:
            await self._stack.aclose()
        self._session = None
        self._stack = None

    # ── Tool call wrapper ─────────────────────────────────────────────────

    async def _call(self, tool: str, **kwargs: Any) -> dict[str, Any]:
        """Call a named MCP tool with keyword arguments and decode the response."""
        assert (
            self._session is not None
        ), "Agent not connected. Use 'async with agent:'."
        _progress(f"[tactical] → {tool} …")
        try:
            raw = await asyncio.wait_for(
                self._session.call_tool(tool, kwargs),
                timeout=self.tool_timeout_s,
            )
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"MCP tool {tool!r} timed out after {self.tool_timeout_s}s. "
                "Check DATABASE_URL, network, and OpenAI API availability."
            ) from exc
        return _decode(raw)

    # ── Abstract pipeline ─────────────────────────────────────────────────

    async def run(self, *args: Any, **kwargs: Any) -> Any:
        """Override in subclasses to implement the specific pipeline."""
        raise NotImplementedError("Subclasses must implement run()")
