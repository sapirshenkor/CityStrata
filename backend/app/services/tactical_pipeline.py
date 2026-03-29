"""Run the tactical MCP pipeline from the API (single-family and community)."""

import sys
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

from app.core.database import get_pool

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_MCP_DIR = _BACKEND_DIR / "mcp"
if str(_MCP_DIR) not in sys.path:
    sys.path.insert(0, str(_MCP_DIR))

from tactical_agent import (  # noqa: E402
    _save_tactical_result,
    run_community_pipeline,
    run_pipeline,
)


async def execute_tactical_pipeline(profile_uuid: UUID) -> str:
    """
    Run the full tactical pipeline for one family.
    Returns the Markdown report string (also persisted by tactical_agent).
    """
    return await run_pipeline(str(profile_uuid))


def _culture_rank(value: Any) -> int:
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


def _merge_evacuee_rows_for_insert(
    rows: list[Any],
    source_uuids: list[UUID],
) -> dict[str, Any]:
    """
    Merge DB rows into one profile dict (same rules as MCP get_community_context).
    """
    first = rows[0]
    names = [r["family_name"] for r in rows]
    family_name = "Community: " + " & ".join(names)

    total_people = sum(int(r["total_people"] or 0) for r in rows)
    infants = sum(int(r["infants"] or 0) for r in rows)
    preschool = sum(int(r["preschool"] or 0) for r in rows)
    elementary = sum(int(r["elementary"] or 0) for r in rows)
    youth = sum(int(r["youth"] or 0) for r in rows)
    adults = sum(int(r["adults"] or 0) for r in rows)
    seniors = sum(int(r["seniors"] or 0) for r in rows)

    has_mobility = any(bool(r["has_mobility_disability"]) for r in rows)
    has_car_all = all(bool(r["has_car"]) for r in rows)

    edu_imp = max(int(r["education_proximity_importance"] or 0) for r in rows)
    social_imp = max(int(r["social_venues_importance"] or 0) for r in rows)
    services_imp = max(int(r["services_importance"] or 0) for r in rows)

    essential_union: list[str] = []
    seen_e: set[str] = set()
    for r in rows:
        for tag in list(r["essential_education"] or []):
            t = str(tag).strip()
            if t and t not in seen_e:
                seen_e.add(t)
                essential_union.append(t)

    affil_set = {
        str(r["religious_affiliation"] or "").strip()
        for r in rows
        if str(r["religious_affiliation"] or "").strip()
    }
    merged_affiliation = (
        next(iter(affil_set)) if len(affil_set) == 1 else "other"
    )

    culture_rank = max(_culture_rank(r["culture_frequency"]) for r in rows)
    culture_frequency = _culture_from_rank(culture_rank)

    notes_parts = [
        f"[{r['family_name']}] {r['notes']}"
        for r in rows
        if (r["notes"] or "").strip()
    ]
    merger_line = (
        "[Community merged profile — sources: "
        + ", ".join(str(u) for u in source_uuids)
        + "]"
    )
    merged_notes = merger_line
    if notes_parts:
        merged_notes = merger_line + "\n" + " | ".join(notes_parts)

    matching_id = first["selected_matching_result_id"]
    if matching_id is None:
        raise ValueError("Source profiles must have macro matching completed.")

    # Cluster alignment is validated in execute_community_tactical_pipeline via
    # matching_results (run_id + cluster). Each family has its own matching_results.id;
    # we keep the first profile's FK on the merged row.

    return {
        "family_name": family_name,
        "contact_name": first["contact_name"],
        "contact_phone": first["contact_phone"],
        "contact_email": first["contact_email"],
        "home_stat_2022": first["home_stat_2022"],
        "city_name": first["city_name"],
        "home_address": first["home_address"],
        "total_people": total_people,
        "infants": infants,
        "preschool": preschool,
        "elementary": elementary,
        "youth": youth,
        "adults": adults,
        "seniors": seniors,
        "has_mobility_disability": has_mobility,
        "has_car": has_car_all,
        "essential_education": essential_union,
        "education_proximity_importance": edu_imp,
        "religious_affiliation": merged_affiliation,
        "needs_synagogue": any(bool(r["needs_synagogue"]) for r in rows),
        "culture_frequency": culture_frequency,
        "matnas_participation": any(bool(r["matnas_participation"]) for r in rows),
        "social_venues_importance": social_imp,
        "needs_community_proximity": any(
            bool(r["needs_community_proximity"]) for r in rows
        ),
        "accommodation_preference": first["accommodation_preference"],
        "estimated_stay_duration": first["estimated_stay_duration"],
        "needs_medical_proximity": any(
            bool(r["needs_medical_proximity"]) for r in rows
        ),
        "services_importance": services_imp,
        "notes": merged_notes,
        "selected_matching_result_id": matching_id,
    }


async def _validate_same_macro_cluster(conn: Any, ordered_rows: list[Any]) -> None:
    """
    Ensure every profile points at a matching row with the same (run_id, cluster).

    Families in the same cluster each have their own ``matching_results`` row
    (different ``id``); comparing ``selected_matching_result_id`` alone is wrong.
    """
    mids = [r["selected_matching_result_id"] for r in ordered_rows]
    if any(m is None for m in mids):
        raise ValueError("Source profiles must have macro matching completed.")

    mr_rows = await conn.fetch(
        """
        SELECT id, run_id, recommended_cluster_number
        FROM matching_results
        WHERE id = ANY($1::uuid[])
        """,
        mids,
    )
    by_id = {r["id"]: r for r in mr_rows}
    ref: Optional[tuple[Any, int]] = None
    for mid in mids:
        row = by_id.get(mid)
        if row is None:
            raise ValueError(f"Matching result {mid} not found.")
        if row["run_id"] is None or row["recommended_cluster_number"] is None:
            raise ValueError(
                f"Matching result {mid} is incomplete (missing run or cluster)."
            )
        key = (row["run_id"], int(row["recommended_cluster_number"]))
        if ref is None:
            ref = key
        elif key != ref:
            raise ValueError(
                "All selected families must share the same macro cluster "
                "(same clustering run and same cluster number). "
                "Choose families that were matched to the same cluster."
            )


async def execute_community_tactical_pipeline(
    profile_uuids: list[UUID],
) -> UUID:
    """
    Validate source profiles, run community tactical MCP flow, insert merged
    ``evacuee_family_profiles`` row, persist tactical report for the new profile.

    Returns the new profile UUID.
    """
    if len(profile_uuids) < 2:
        raise ValueError("Select at least two family profiles.")

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM evacuee_family_profiles
            WHERE uuid = ANY($1::uuid[])
            """,
            profile_uuids,
        )
        by_uuid = {r["uuid"]: r for r in rows}
        ordered = [by_uuid.get(u) for u in profile_uuids]
        if None in ordered:
            missing = [str(u) for u in profile_uuids if u not in by_uuid]
            raise ValueError(f"Profile(s) not found: {missing}")

        await _validate_same_macro_cluster(conn, ordered)
        merged = _merge_evacuee_rows_for_insert(ordered, profile_uuids)

    uid_strings = [str(u) for u in profile_uuids]
    tactical_result = await run_community_pipeline(uid_strings)
    if not tactical_result.ok:
        raise ValueError(tactical_result.report)

    async with pool.acquire() as conn:
        new_row = await conn.fetchrow(
            """
            INSERT INTO evacuee_family_profiles (
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
                $27, $28, $29, $30
            )
            RETURNING uuid
            """,
            merged["family_name"],
            merged["contact_name"],
            merged["contact_phone"],
            merged["contact_email"],
            merged["home_stat_2022"],
            merged["city_name"],
            merged["home_address"],
            merged["total_people"],
            merged["infants"],
            merged["preschool"],
            merged["elementary"],
            merged["youth"],
            merged["adults"],
            merged["seniors"],
            merged["has_mobility_disability"],
            merged["has_car"],
            merged["essential_education"],
            merged["education_proximity_importance"],
            merged["religious_affiliation"],
            merged["needs_synagogue"],
            merged["culture_frequency"],
            merged["matnas_participation"],
            merged["social_venues_importance"],
            merged["needs_community_proximity"],
            merged["accommodation_preference"],
            merged["estimated_stay_duration"],
            merged["needs_medical_proximity"],
            merged["services_importance"],
            merged["notes"],
            merged["selected_matching_result_id"],
        )

    new_uuid: UUID = new_row["uuid"]
    await _save_tactical_result(
        str(new_uuid),
        tactical_result.report,
        tactical_result.confidence,
        tactical_result.ranked_radii,
    )
    return new_uuid
