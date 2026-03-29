"""
CityStrata Tactical Agent — Multi-Family Pipeline

Orchestrates the MCP tools into a holistic radius-based relocation
recommendation for MULTIPLE families relocating together within a
single assigned cluster.

Pipeline
--------
0. ensure_multi_family_profile    — create/retrieve aggregated profile
1. get_community_context          — merged family profiles + shared cluster
2. discover_optimal_radius        — PostGIS K-means hubs (merged need tags)
3. community_semantic_scoring     — pgvector centroid ranking (all families)
4. GPT-4o generation              — group-centric Markdown recommendation
5. save_multi_family_response     — persist to multi_family_tactical_responses

Usage
-----
    python multi_family_agent.py --family-ids <uuid> <uuid> [<uuid> ...]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI

from base_agent import (
    BaseTacticalAgent,
    _AI_MODEL,
    _AI_TIMEOUT,
    _PHASE_LABELS_HE,
    _aggregate_phase_counts,
    _build_needs_text,
    _extract_needs_tags,
    _he_zone_label,
    _needed_education_phases,
    _progress,
    _project_root,
    _relevant_categories,
    _resolve_education_supervision,
    ensure_multi_family_profile,
    logger,
    save_multi_family_response,
)


@dataclass
class MultiFamilyTacticalResult:
    """Outcome of the multi-family pipeline (for API persistence and CLI)."""

    ok: bool
    report: str
    ranked_radii: list[dict[str, Any]]
    confidence: Optional[str] = None
    multi_family_uuid: Optional[str] = None


# ─── Multi-family-specific helpers ────────────────────────────────────────────


def _multi_family_resolve_education_supervision(
    member_families: list[dict[str, Any]],
) -> Optional[str]:
    """Same DB supervision filter for all members only; else None (mixed sectors)."""
    vals: list[str] = []
    for m in member_families:
        fn = m.get("family_needs") or {}
        v = _resolve_education_supervision(fn)
        if v is not None:
            vals.append(v)
    if not vals:
        return None
    if len(set(vals)) == 1:
        return vals[0]
    return None


# ─── GPT-4o multi-family recommendation ──────────────────────────────────────

_MULTI_FAMILY_SYSTEM_PROMPT = """\
You are a Tactical Relocation Expert at CityStrata, specialising in **community
relocation** — multiple displaced families moving together within one assigned cluster.

**Output language:** Write the **entire** recommendation **only in Hebrew**
(modern Israeli Hebrew). No English paragraphs, headings, or bullet labels.

Explain trade-offs between families (e.g. which zone answers one household's
education needs and another's medical access). Use ONLY facts from the JSON.
Address each household by **family_name** when attributing needs (names may stay
as in the data). Rank up to three zones and explain why lower ranks are weaker
for the group. Do not cite raw semantic scores.

Use Hebrew zone names only: אזור אלפא, אזור בטא, אזור גמא (matching the JSON
zone_label values zone_alpha / zone_beta / zone_gamma).
"""


def _build_multi_family_grounding_context(
    member_families: list[dict[str, Any]],
    multi_family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
) -> dict[str, Any]:
    members_out: list[dict[str, Any]] = []
    for m in member_families:
        fn = m.get("family_needs") or {}
        comp = fn.get("composition") or {}
        members_out.append(
            {
                "family_name": fn.get("family_name"),
                "family_uuid": fn.get("family_uuid"),
                "household_size": comp.get("total_people"),
                "children": {
                    k: v
                    for k, v in comp.items()
                    if k in ("infants", "preschool", "elementary", "youth") and v
                },
                "education": (fn.get("education") or {}),
                "religion": fn.get("religion") or {},
                "community": fn.get("community") or {},
                "lifestyle": fn.get("lifestyle") or {},
                "medical": fn.get("medical") or {},
                "mobility": fn.get("mobility") or {},
                "notes": fn.get("notes"),
                "needed_education_phases": _needed_education_phases(fn),
            }
        )

    return {
        "mode": "community_relocation",
        "community_summary": {
            "label": multi_family_needs.get("family_name"),
            "total_people": (multi_family_needs.get("composition") or {}).get(
                "total_people"
            ),
            "merged_notes": multi_family_needs.get("notes"),
        },
        "families": members_out,
        "cluster_name": cluster.get("cluster_name"),
        "cluster_reasoning": cluster.get("reasoning"),
        "education_supervision_filter": (
            ranked_radii[0].get("education_supervision_filter")
            if ranked_radii
            else None
        ),
        "recommended_zones": [
            {
                "rank": i + 1,
                "zone_label": r.get("hub_label"),
                "center_lat": r.get("center_lat"),
                "center_lng": r.get("center_lng"),
                "radius_m": r.get("radius_m"),
                "semantic_score": r.get("semantic_score"),
                "embeddings_matched": r.get("embeddings_matched"),
                "total_amenities": r.get("total_amenities"),
                "amenity_counts": r.get("amenity_counts") or {},
                "education_matched": r.get("education_matched"),
                "education_special": r.get("education_special"),
                "education_phase_counts": _aggregate_phase_counts(
                    r.get("education_phase_counts") or {}
                ),
            }
            for i, r in enumerate(ranked_radii[:3])
        ],
    }


async def _generate_multi_family_recommendation(
    member_families: list[dict[str, Any]],
    multi_family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        logger.warning(
            "OPENAI_API_KEY not set — skipping multi-family AI generation."
        )
        return None

    context = _build_multi_family_grounding_context(
        member_families, multi_family_needs, cluster, ranked_radii
    )
    user_prompt = (
        "הסבר על קהילה — פרופילים לפי משפחה ואזורים מומלצים. "
        "חובה לכתוב את כל ההמלצה בעברית בלבד. השתמש רק בנתוני ה-JSON הבאים:\n\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )

    _progress("[tactical] Calling GPT-4o for multi-family recommendation…")
    try:
        client = AsyncOpenAI(api_key=api_key, timeout=_AI_TIMEOUT)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=_AI_MODEL,
                temperature=0.3,
                max_tokens=2_000,
                messages=[
                    {"role": "system", "content": _MULTI_FAMILY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            ),
            timeout=_AI_TIMEOUT + 5,
        )
        letter = (response.choices[0].message.content or "").strip()
        _progress("[tactical] GPT-4o multi-family response received.")
        return letter or None
    except Exception as exc:
        logger.warning("Multi-family AI generation failed (non-fatal): %s", exc)
        _progress(f"[tactical] Multi-family AI skipped ({exc}).")
        return None


# ─── Multi-family report formatter ───────────────────────────────────────────


def _format_multi_family_report(
    member_families: list[dict[str, Any]],
    multi_family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
    ai_letter: Optional[str],
) -> str:
    """Markdown report for multi-family relocation (merged relevance + per-family blurbs)."""
    RTL = "\u200F"
    names = ", ".join(
        (m.get("family_needs") or {}).get("family_name") or "—"
        for m in member_families
    )
    comp = multi_family_needs.get("composition") or {}
    cluster_name = cluster.get("cluster_name") or f"אשכול {cluster.get('cluster_number')}"

    lines: list[str] = [
        f"{RTL} דו״ח מיקום טקטי — קהילה | CityStrata",
        "",
        f"**משפחות:** {names}  ",
        f"**סה״כ נפשות:** {comp.get('total_people', '?')}  ",
        f"**אשכול מוקצה:** {cluster_name}  ",
        f"**רמת וודאות:** {cluster.get('confidence', '—')}  ",
        "",
        "**פירוט משפחות:**",
        "",
    ]
    for m in member_families:
        fn = m.get("family_needs") or {}
        fname = fn.get("family_name") or "משפחה"
        lines.append(f"- **{fname}:** {_build_needs_text(fn)}")
    lines.append("")

    notes = multi_family_needs.get("notes")
    if notes:
        lines += [f"**הערות משולבות:** {notes}  ", ""]

    lines += ["---", ""]

    if ai_letter:
        lines += ["## המלצת המערכת (קהילה)", "", ai_letter, "", "---", ""]

    relevant = _relevant_categories(multi_family_needs)
    needed_phases = _needed_education_phases(multi_family_needs)
    lines += ["## אזורי מגורים מומלצים לקהילה", ""]

    priority_labels = ["עדיפות ראשונה", "עדיפות שנייה", "עדיפות שלישית"]

    for i, zone in enumerate(ranked_radii[:3]):
        counts = zone.get("amenity_counts") or {}
        hub_raw = zone.get("hub_label") or f"zone_{i}"
        label = _he_zone_label(hub_raw)
        lat = zone.get("center_lat", 0.0)
        lng = zone.get("center_lng", 0.0)
        radius = zone.get("radius_m", 0)
        education_special = zone.get("education_special")
        raw_phase_counts = zone.get("education_phase_counts") or {}
        phase_counts = _aggregate_phase_counts(raw_phase_counts)
        priority = (
            priority_labels[i] if i < len(priority_labels) else f"עדיפות {i + 1}"
        )

        lines += [
            f"### {priority}: {label}",
            "",
            f"* **מיקום וכיסוי:** `{lat:.5f}, {lng:.5f}` (רדיוס: {radius} מ׳)",
        ]

        amenity_bullets: list[str] = []

        if "education" in relevant:
            phase_parts: list[str] = []
            for phase_key in ("kindergarten", "elementary", "high_school"):
                if phase_key in needed_phases:
                    cnt = phase_counts.get(phase_key, 0)
                    if cnt:
                        phase_parts.append(f"{cnt} {_PHASE_LABELS_HE[phase_key]}")

            if phase_parts:
                amenity_bullets.append(
                    f"  - **חינוך (לפי צרכי הילדים בקהילה):** {', '.join(phase_parts)}."
                )
            else:
                all_edu = counts.get("education", 0)
                if all_edu:
                    amenity_bullets.append(
                        f"  - **חינוך:** {all_edu} מוסדות חינוך בסביבה."
                    )

        if "education_special" in relevant and education_special:
            amenity_bullets.append(
                f"  - **חינוך מיוחד:** {education_special} בתי ספר לחינוך מיוחד."
            )

        if "synagogue" in relevant:
            syn_count = counts.get("synagogue", 0)
            if syn_count:
                amenity_bullets.append(f"  - **דת:** {syn_count} בתי כנסת בסביבה.")

        if "cafe" in relevant or "restaurant" in relevant:
            cafe_count = counts.get("cafe", 0) if "cafe" in relevant else 0
            rest_count = counts.get("restaurant", 0) if "restaurant" in relevant else 0
            prts: list[str] = []
            if rest_count:
                prts.append(f"{rest_count} מסעדות")
            if cafe_count:
                prts.append(f"{cafe_count} בתי קפה")
            if prts:
                amenity_bullets.append(
                    f"  - **אורח חיים:** {' ו-'.join(prts)} לצרכים חברתיים."
                )

        if "matnas" in relevant:
            matnas_count = counts.get("matnas", 0)
            if matnas_count:
                amenity_bullets.append(
                    f"  - **קהילה:** {matnas_count} מתנ״ס בסביבה."
                )

        if "city_facility" in relevant:
            cf_count = counts.get("city_facility", 0)
            if cf_count:
                amenity_bullets.append(
                    f"  - **מתקנים עירוניים:** {cf_count} פארקים, שירותים ומוסדות."
                )

        if amenity_bullets:
            lines.append("* **מתקנים עיקריים באזור (קהילה):**")
            lines.extend(amenity_bullets)

        lines.append("")

    lines += [
        "---",
        "",
        f"*{RTL} CityStrata — דו״ח קהילתי; דירוג סמנטי לפי ממוצע וקטורי (centroid).*",
    ]
    return "\n".join(lines)


# ─── Multi-Family Agent ──────────────────────────────────────────────────────


class MultiFamilyTacticalAgent(BaseTacticalAgent):
    """
    Multi-family tactical pipeline.

    Connects to the CityStrata MCP server over stdio and executes the
    four-step holistic pipeline for a group of families sharing a cluster.

    Usage::

        async with MultiFamilyTacticalAgent() as agent:
            result = await agent.run(family_ids)
    """

    async def run(self, family_ids: list[str]) -> MultiFamilyTacticalResult:
        """
        Multi-family pipeline:
            0. Ensure aggregated profile in ``multi_family_profiles``.
            1. ``get_community_context`` — merged family needs + shared cluster.
            2. ``discover_optimal_radius`` — K-means hub discovery.
            3. ``community_semantic_scoring`` — centroid embedding ranking.
            4. GPT-4o group-centric recommendation.
            5. Persist response to ``multi_family_tactical_responses``.
        """
        ids = [x.strip() for x in family_ids if x and str(x).strip()]
        if not ids:
            return MultiFamilyTacticalResult(
                ok=False,
                report="# Error\n\nNo family UUIDs supplied.",
                ranked_radii=[],
            )

        # ── Step 0: Ensure multi-family profile exists ────────────────────
        mf_uuid: Optional[str] = None
        try:
            mf_uuid = await ensure_multi_family_profile(ids)
        except Exception as exc:
            logger.warning("Multi-family profile creation failed (non-fatal): %s", exc)
            _progress(f"[tactical] Multi-family profile skipped ({exc}).")

        # ── Step 1: Load merged context ───────────────────────────────────
        _progress("[tactical] Multi-Family 1/4: Loading merged context…")
        ctx = await self._call("get_community_context", family_ids=ids)
        if not ctx.get("ok"):
            return MultiFamilyTacticalResult(
                ok=False,
                report=(
                    f"# Error — Multi-Family Context Failed\n\n"
                    f"{ctx.get('error', 'Unknown error.')}"
                ),
                ranked_radii=[],
                multi_family_uuid=mf_uuid,
            )

        member_families: list[dict[str, Any]] = ctx["member_families"]
        multi_family_needs: Optional[dict[str, Any]] = ctx.get("community_needs")
        cluster: Optional[dict[str, Any]] = ctx.get("cluster")

        if not multi_family_needs or not cluster or not cluster.get("run_id"):
            return MultiFamilyTacticalResult(
                ok=False,
                report=(
                    "# Multi-Family Context Incomplete\n\n"
                    f"{ctx.get('error', 'Missing cluster or merged profile.')}"
                ),
                ranked_radii=[],
                multi_family_uuid=mf_uuid,
            )

        # ── Step 2: Hub discovery ─────────────────────────────────────────
        _progress("[tactical] Multi-Family 2/4: Discovering hubs (merged tags)…")
        needs_tags = _extract_needs_tags(multi_family_needs)
        supervision = _multi_family_resolve_education_supervision(member_families)
        if supervision:
            _progress(f"[tactical]   Education filter (unanimous): {supervision}")

        radii_result = await self._call(
            "discover_optimal_radius",
            run_id=cluster["run_id"],
            cluster_number=cluster["cluster_number"],
            education_supervision=supervision,
            needs_tags=needs_tags,
        )

        if not radii_result.get("ok") or not radii_result.get("radii"):
            return MultiFamilyTacticalResult(
                ok=False,
                report=(
                    "# No Radii Found (Multi-Family)\n\n"
                    f"Could not identify service hubs in cluster "
                    f"`{cluster.get('cluster_name')}` (#{cluster['cluster_number']}).\n\n"
                    f"Reason: {radii_result.get('error', 'No amenities in boundary.')}"
                ),
                ranked_radii=[],
                multi_family_uuid=mf_uuid,
            )

        radii: list[dict[str, Any]] = radii_result["radii"]
        per_family_texts = [
            _build_needs_text(m["family_needs"]) for m in member_families
        ]

        # ── Step 3: Semantic scoring (centroid) ───────────────────────────
        _progress("[tactical] Multi-Family 3/4: Semantic scoring (centroid)…")
        score_result = await self._call(
            "community_semantic_scoring",
            radii=radii,
            family_needs_texts=per_family_texts,
            education_supervision=supervision,
        )
        ranked_radii: list[dict[str, Any]] = (
            score_result.get("ranked_radii") or radii
        )

        # ── Step 4: Group-centric report ──────────────────────────────────
        _progress("[tactical] Multi-Family 4/4: Group-centric report…")
        ai_letter = await _generate_multi_family_recommendation(
            member_families, multi_family_needs, cluster, ranked_radii
        )
        report = _format_multi_family_report(
            member_families, multi_family_needs, cluster, ranked_radii, ai_letter
        )

        # ── Step 5: Persist response ──────────────────────────────────────
        if mf_uuid:
            await save_multi_family_response(
                mf_uuid,
                report,
                confidence=cluster.get("confidence"),
                radii_data=ranked_radii,
            )

        return MultiFamilyTacticalResult(
            ok=True,
            report=report,
            ranked_radii=ranked_radii,
            confidence=cluster.get("confidence"),
            multi_family_uuid=mf_uuid,
        )


# ─── Pipeline entry point ─────────────────────────────────────────────────────


async def run_multi_family_pipeline(
    family_ids: list[str],
    *,
    server_path: Optional[Path] = None,
    tool_timeout_s: float = 300.0,
    forward_server_stderr: bool = False,
) -> MultiFamilyTacticalResult:
    """Async entry — multi-family relocation (extra embeddings + group report)."""
    mcp_dir = Path(__file__).resolve().parent
    load_dotenv(_project_root() / ".env")
    load_dotenv(mcp_dir / ".env")

    async with MultiFamilyTacticalAgent(
        mcp_server_script=server_path,
        tool_timeout_s=tool_timeout_s,
        forward_server_stderr=forward_server_stderr,
    ) as agent:
        return await agent.run(family_ids)


# ─── CLI ──────────────────────────────────────────────────────────────────────


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="CityStrata Multi-Family Tactical Agent — multi-family relocation planner",
    )
    parser.add_argument(
        "--family-ids",
        nargs="+",
        metavar="UUID",
        required=True,
        help="Two or more family UUIDs (same cluster).",
    )
    parser.add_argument(
        "--server",
        type=Path,
        default=None,
        help="Override path to mcp_server.py (default: sibling file)",
    )
    parser.add_argument(
        "--tool-timeout",
        type=float,
        default=300.0,
        help="Per-tool-call timeout in seconds (default: 300)",
    )
    parser.add_argument(
        "--forward-server-stderr",
        action="store_true",
        help="Pipe mcp_server.py stderr to this terminal (may deadlock on Windows)",
    )
    args = parser.parse_args()

    if len(args.family_ids) < 2:
        print(
            "Error: --family-ids requires at least two UUIDs.",
            file=sys.stderr,
        )
        sys.exit(2)

    try:
        result = asyncio.run(
            run_multi_family_pipeline(
                args.family_ids,
                server_path=args.server,
                tool_timeout_s=max(args.tool_timeout, 300.0),
                forward_server_stderr=args.forward_server_stderr,
            )
        )
        print(result.report, flush=True)
        if not result.ok:
            sys.exit(1)
    except TimeoutError as exc:
        print(f"\nTimed out: {exc}", file=sys.stderr)
        sys.exit(124)
    except (RuntimeError, OSError) as exc:
        print(f"\nFailed: {exc}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
