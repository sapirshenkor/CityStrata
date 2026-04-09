"""
CityStrata Tactical Agent — Single-Family Pipeline

Orchestrates the three MCP tools into a holistic radius-based relocation
recommendation for ONE family, considering ALL amenity categories —
education, religion, community, cafes, restaurants, city facilities,
and medical services.

Pipeline
--------
1. get_evacuation_context   — full family profile + assigned cluster boundary
2. discover_optimal_radius  — PostGIS K-means hubs across ALL amenities
3. semantic_radius_scoring  — pgvector ranking against holistic family needs
4. GPT-4o generation        — grounded Markdown recommendation report

Usage
-----
    python family_agent.py --family-id <uuid>
    TACTICAL_SAMPLE_FAMILY_ID=<uuid> python family_agent.py
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Optional

import asyncpg
from dotenv import load_dotenv
from openai import AsyncOpenAI

from base_agent import BaseTacticalAgent, _progress, _project_root
from tactical_utils import (
    AI_MODEL,
    AI_TIMEOUT,
    PHASE_LABELS_HE,
    aggregate_phase_counts,
    build_needs_text,
    build_semantic_filter_text,
    extract_needs_tags,
    extract_priority_tags,
    he_zone_label,
    needed_education_phases,
    relevant_categories,
    resolve_education_supervision,
)

logger = logging.getLogger(__name__)


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


# ─── GPT-4o grounded recommendation ──────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a Tactical Relocation Expert at CityStrata, specialising in emergency
shelter placement for Israeli families displaced by conflict.

Your task: synthesise spatial and semantic analysis results into a clear,
professional, and human-friendly recommendation of the best relocation zones
within the family's assigned cluster.

STRICT RULES — follow without exception:

1. **Data integrity & priority ranking:**
   Use ONLY the numerical facts in the user message (amenity counts, distances,
   education phases). Do not invent, estimate, or assume data not provided.

   Your task is to **rank** the zones as:
   - **"עדיפות ראשונה"** — the zone that best matches the family's needs.
   - **"עדיפות שנייה"** — a solid alternative with minor trade-offs.
   - **"עדיפות שלישית"** — viable but with notable compromises.

   Decision criteria (in order of weight):
     (a) **Education** — does the zone contain schools matching the children's
         exact age phases *and* the family's required supervision type?  A zone
         missing an entire required phase (e.g. no kindergartens when the family
         has toddlers) is a major weakness.
     (b) **Religion / Community** — presence of synagogues, Matnasim.
     (c) **Personal Requests** — address the family's `notes` (e.g. "quiet
         place") as a tie-breaker between otherwise similar zones.

   For each zone ranked below "עדיפות ראשונה", you **must** explain clearly
   why it was ranked lower, e.g. "אזור זה דורג בעדיפות שלישית בשל היעדר
   מוסדות חינוך לגיל היסודי".  Use an encouraging, balanced tone — frame
   gaps as *trade-offs*, not failures.

   Do **NOT** mention numerical scores or "ציון" — present the ranking as a
   consultant's professional recommendation based on the data.

2. **Relevance filter — mention ONLY what matters to THIS family:**
   - Education: mention only if the family has school-age children or education
     essential_tags are present.

     **Age-appropriate matching:** The data includes `needed_education_phases`
     (the stages the family's children actually need, e.g. ["kindergarten",
     "elementary"]) and per-zone `education_phase_counts` (how many schools of
     each stage exist in the zone). Mention ONLY the stages that appear in
     `needed_education_phases`. If the family only has a high-schooler, do NOT
     mention kindergartens — even if the data shows them nearby.

     **Sector-specific Hebrew terminology:** Use the supervision label from
     `education_supervision_filter` to choose the correct Hebrew phrasing, and
     combine it with the age stage. The exact mapping is:
       • `education_supervision_filter` = "State Religious"  (religious / traditional)
         → stage label: "גני ילדים שמתאימים לחינוך הממלכתי-דתי" (preschool/infants)
                         "בתי ספר שמתאימים לחינוך הממלכתי-דתי" (elementary/youth)
       • `education_supervision_filter` = "Ultra-Orthodox"  (haredi)
         → stage label: "מוסדות חינוך חרדיים" (any stage)
       • `education_supervision_filter` = "State"  (secular)  or absent
         → stage label: "גני ילדים ממלכתיים" (preschool/infants)
                         "בתי ספר ממלכתיים" (elementary/youth)
     Example output: "נמצאו 5 גני ילדים שמתאימים לחינוך הממלכתי-דתי ו-2 בתי ספר
     שמתאימים לחינוך הממלכתי-דתי."
     If `education_supervision_filter` is absent and the language is Hebrew,
     fall back to the secular Hebrew labels.

   - Special Education: mention ONLY if `has_mobility_disability` is true OR the
     `notes` field explicitly references special needs / special education. If
     neither condition holds, do NOT mention special education at all — even if
     the data shows special-education schools nearby.
   - Synagogues / Religion: mention only if the family has a religious affiliation
     or needs_synagogue is true.
   - Community Centres (Matnas): mention only if matnas_participation is true or
     needs_community_proximity is true.
   - Cafés / Restaurants: mention only if social_venues_importance >= 3 or the
     notes suggest social or dining needs.
   - City Facilities / Parks: mention only if culture_frequency >= 3 or the notes
     reference parks, green space, or outdoor needs.
   - Medical: mention only if needs_medical_proximity is true or
     services_importance >= 4.

3. **Prioritise the `notes` field:** The `notes` field contains the family's own
   words or caseworker instructions. Treat it as a HIGH-PRIORITY requirement:
   - Analyse the notes and explicitly address them in your reasoning.
   - If the notes request a "quiet place" (e.g. "זקוקים למקום שקט"), favour zones
     with fewer noisy commercial venues or explain why a zone still fits despite
     nearby restaurants / cafes.
   - If the notes mention specific needs (medical, accessibility, schooling, etc.)
     make sure your recommendation directly responds to them.

4. **Structure:** Recommend up to 3 zones in order of suitability:
   - One brief opening paragraph acknowledging the family's situation and any
     special requests from the notes.
   - Per zone: a concise paragraph explaining why it fits this family, referencing
     only the amenity categories that are relevant (see rule 2).
   - A short closing paragraph with an overall recommendation.

5. **Language & zone naming (mandatory — Hebrew only):** Write the **entire**
   recommendation **only in Hebrew** (modern Israeli Hebrew). Do not use English
   sentences, headings, or labels in the output. If `family_name` is in Latin
   script, still write all narrative and headings in Hebrew; you may mention the
   family name as stored in the data.
   - Zone names: "אזור אלפא", "אזור בטא", "אזור גמא" (matching zone_alpha,
     zone_beta, zone_gamma). Any other zone → "אזור [מספר]".
   - Use Hebrew labels consistently: "מיקום וכיסוי", "מתקנים עיקריים",
     "חינוך:", "דת:", "אורח חיים:", "קהילה:", "מתקנים עירוניים:".
   - Never mix English zone labels ("Zone Alpha") with Hebrew — use only the
     Hebrew names above.

6. **Tone:** Clear, empathetic, and professional. Acknowledge the difficulty of
   displacement without being melodramatic.

7. Do not add a subject line or sign-off; the output is embedded in a larger
   report.
"""


def _build_grounding_context(
    family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Serialise only hard DB facts for the GPT-4o prompt.

    This is the anti-hallucination boundary: the model receives exactly this
    dict and cannot mention anything not present here.
    Includes the full holistic amenity breakdown so GPT-4o can reason about
    cafes, restaurants, and city facilities alongside anchor institutions.
    """
    comp = family_needs.get("composition") or {}
    edu = family_needs.get("education") or {}
    rel = family_needs.get("religion") or {}
    comm = family_needs.get("community") or {}
    mob = family_needs.get("mobility") or {}
    lifestyle = family_needs.get("lifestyle") or {}
    medical = family_needs.get("medical") or {}

    return {
        "family_name": family_needs.get("family_name"),
        "household_size": comp.get("total_people"),
        "children": {
            k: v
            for k, v in comp.items()
            if k in ("infants", "preschool", "elementary", "youth") and v
        },
        "education": {
            "essential_tags": edu.get("essential_tags") or [],
            "proximity_importance": edu.get("proximity_importance"),
        },
        "religion": {
            "affiliation": rel.get("affiliation"),
            "needs_synagogue": rel.get("needs_synagogue"),
        },
        "community": {
            "matnas_participation": comm.get("matnas_participation"),
            "needs_community_proximity": comm.get("needs_community_proximity"),
            "social_importance": comm.get("social_importance"),
        },
        "lifestyle": {
            "social_venues_importance": lifestyle.get("social_venues_importance"),
            "culture_frequency": lifestyle.get("culture_frequency"),
        },
        "medical": {
            "needs_medical_proximity": medical.get("needs_medical_proximity"),
            "services_importance": medical.get("services_importance"),
        },
        "mobility": {
            "has_car": mob.get("has_car"),
            "has_mobility_disability": mob.get("has_mobility_disability"),
        },
        "notes": family_needs.get("notes"),
        "needed_education_phases": needed_education_phases(family_needs),
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
                "education_phase_counts": aggregate_phase_counts(
                    r.get("education_phase_counts") or {}
                ),
            }
            for i, r in enumerate(ranked_radii[:3])
        ],
    }


async def _generate_recommendation(
    family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
) -> Optional[str]:
    """
    Call GPT-4o with a structured system + user prompt.
    Returns None on any failure (non-fatal — static report is always returned).
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — skipping AI generation.")
        return None

    context = _build_grounding_context(family_needs, cluster, ranked_radii)
    user_prompt = (
        "להלן פרופיל המשפחה ואזורי המגורים המומלצים (ניתוח מרחבי וסמנטי). "
        "חובה לכתוב את כל המלצת המערכת בעברית בלבד, ולהשתמש רק בנתונים הבאים:\n\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )

    _progress("[tactical] Calling GPT-4o for recommendation…")
    try:
        client = AsyncOpenAI(api_key=api_key, timeout=AI_TIMEOUT)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=AI_MODEL,
                temperature=0.3,
                max_tokens=1_600,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            ),
            timeout=AI_TIMEOUT + 5,
        )
        letter = (response.choices[0].message.content or "").strip()
        _progress("[tactical] GPT-4o response received.")
        return letter or None

    except Exception as exc:
        logger.warning("AI generation failed (non-fatal): %s", exc)
        _progress(
            f"[tactical] AI generation skipped ({exc}). Continuing with static report."
        )
        return None


async def _build_semantic_filter_vector(needs_text: str) -> Optional[list[float]]:
    """
    Build the family's embedding vector for radius pre-filtering.

    Non-fatal: returns None when embedding generation fails so the pipeline can
    continue with tag-based personalization only.
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        client = AsyncOpenAI(api_key=api_key, timeout=AI_TIMEOUT)
        response = await asyncio.wait_for(
            client.embeddings.create(
                model="text-embedding-3-small",
                input=needs_text,
            ),
            timeout=AI_TIMEOUT + 5,
        )
        vec = response.data[0].embedding if response.data else None
        return list(vec) if vec else None
    except Exception as exc:
        logger.warning("Semantic filter vector generation failed (non-fatal): %s", exc)
        return None


# ─── Report formatter ─────────────────────────────────────────────────────────


def _format_report(
    family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
    ai_letter: Optional[str],
) -> str:
    """Build the final Markdown tactical report from pipeline outputs."""
    name = family_needs.get("family_name") or "משפחה לא ידועה"
    comp = family_needs.get("composition") or {}
    cluster_name = (
        cluster.get("cluster_name") or f"אשכול {cluster.get('cluster_number')}"
    )

    RTL = "\u200f"

    lines: list[str] = [
        f"{RTL} דו״ח מיקום טקטי — CityStrata | {name}",
        "",
        f"**אשכול מוקצה:** {cluster_name}  ",
        f"**גודל משק בית:** {comp.get('total_people', '?')}  ",
        f"**רמת וודאות:** {cluster.get('confidence', '—')}  ",
        "",
    ]

    notes = family_needs.get("notes")
    if notes:
        lines += [f"**הערות המשפחה:** {notes}  ", ""]

    lines += ["---", ""]

    if ai_letter:
        lines += ["## המלצת המערכת", "", ai_letter, "", "---", ""]

    rel = relevant_categories(family_needs)
    phases_needed = needed_education_phases(family_needs)

    lines += ["## אזורי מגורים מומלצים", ""]

    _PRIORITY_LABELS = ["עדיפות ראשונה", "עדיפות שנייה", "עדיפות שלישית"]

    for i, zone in enumerate(ranked_radii[:3]):
        counts = zone.get("amenity_counts") or {}
        hub_raw = zone.get("hub_label") or f"zone_{i}"
        label = he_zone_label(hub_raw)
        lat = zone.get("center_lat", 0.0)
        lng = zone.get("center_lng", 0.0)
        radius = zone.get("radius_m", 0)

        education_special = zone.get("education_special")
        raw_phase_counts = zone.get("education_phase_counts") or {}
        phase_counts = aggregate_phase_counts(raw_phase_counts)

        priority = (
            _PRIORITY_LABELS[i] if i < len(_PRIORITY_LABELS) else f"עדיפות {i + 1}"
        )

        lines += [
            f"### {priority}: {label}",
            "",
            f"* **מיקום וכיסוי:** `{lat:.5f}, {lng:.5f}` (רדיוס: {radius} מ׳)",
        ]

        amenity_bullets: list[str] = []

        if "education" in rel:
            phase_parts: list[str] = []
            for phase_key in ("kindergarten", "elementary", "high_school"):
                if phase_key in phases_needed:
                    cnt = phase_counts.get(phase_key, 0)
                    if cnt:
                        phase_parts.append(f"{cnt} {PHASE_LABELS_HE[phase_key]}")

            if phase_parts:
                amenity_bullets.append(f"  - **חינוך:** {', '.join(phase_parts)}.")
            else:
                all_edu = counts.get("education", 0)
                if all_edu:
                    amenity_bullets.append(
                        f"  - **חינוך:** {all_edu} מוסדות חינוך בסביבה."
                    )

        if "education_special" in rel and education_special:
            amenity_bullets.append(
                f"  - **חינוך מיוחד:** {education_special} בתי ספר לחינוך מיוחד."
            )

        if "synagogue" in rel:
            syn_count = counts.get("synagogue", 0)
            if syn_count:
                amenity_bullets.append(f"  - **דת:** {syn_count} בתי כנסת בסביבה.")

        if "cafe" in rel or "restaurant" in rel:
            cafe_count = counts.get("cafe", 0) if "cafe" in rel else 0
            rest_count = counts.get("restaurant", 0) if "restaurant" in rel else 0
            parts: list[str] = []
            if rest_count:
                parts.append(f"{rest_count} מסעדות")
            if cafe_count:
                parts.append(f"{cafe_count} בתי קפה")
            if parts:
                amenity_bullets.append(
                    f"  - **אורח חיים:** {' ו-'.join(parts)} לצרכים חברתיים."
                )

        if "matnas" in rel:
            matnas_count = counts.get("matnas", 0)
            if matnas_count:
                amenity_bullets.append(f"  - **קהילה:** {matnas_count} מתנ״ס בסביבה.")

        if "city_facility" in rel:
            cf_count = counts.get("city_facility", 0)
            if cf_count:
                amenity_bullets.append(
                    f"  - **מתקנים עירוניים:** {cf_count} פארקים, שירותים ומוסדות."
                )

        if amenity_bullets:
            lines.append("* **מתקנים עיקריים באזור:**")
            lines.extend(amenity_bullets)

        lines.append("")

    lines += [
        "---",
        "",
        f"*{RTL} CityStrata — המלצות מבוססות בינה מלאכותית לקהילות מפונות.*",
    ]
    return "\n".join(lines)


# ─── Family Agent ─────────────────────────────────────────────────────────────


class FamilyTacticalAgent(BaseTacticalAgent):
    """
    Single-family tactical pipeline.

    Connects to the CityStrata MCP server over stdio and executes the
    four-step holistic pipeline for one family.

    Usage::

        async with FamilyTacticalAgent() as agent:
            report = await agent.run(family_id)
    """

    async def run(self, family_id: str) -> str:
        """
        Execute the full holistic tactical pipeline and return a Markdown report.

        Steps:
            1. Load evacuation context (full family profile + cluster).
            2. Discover K-means hubs across ALL amenity types.
            3. Score hubs by semantic similarity to holistic family needs.
            4. Generate a GPT-4o grounded recommendation.
        """
        family_id = family_id.strip()

        # ── Step 1: Family profile + cluster ──────────────────────────────
        _progress("[tactical] Step 1/4: Loading evacuation context…")
        ctx = await self._call("get_evacuation_context", family_id=family_id)
        if not ctx.get("ok"):
            return (
                f"# Error — Context Load Failed\n\n{ctx.get('error', 'Unknown error.')}"
            )

        family_needs: dict[str, Any] = ctx["family_needs"]
        cluster: Optional[dict[str, Any]] = ctx.get("cluster")

        if not cluster or not cluster.get("run_id"):
            return (
                "# No Cluster Assignment\n\n"
                f"Family `{family_id}` has not been matched to a cluster yet. "
                "Run the macro matching agent first, then link the result."
            )

        # ── Step 2: Holistic K-means hub discovery ────────────────────────
        _progress("[tactical] Step 2/4: Discovering K-means hubs across all amenities…")
        needs_tags = extract_needs_tags(family_needs)
        priority_tags = extract_priority_tags(family_needs)
        needs_text = build_needs_text(family_needs)
        semantic_filter_text = build_semantic_filter_text(family_needs)
        semantic_filter_vector = await _build_semantic_filter_vector(semantic_filter_text)
        supervision = resolve_education_supervision(family_needs)
        if supervision:
            _progress(f"[tactical]   Education filter: {supervision} schools only")
        radii_result = await self._call(
            "discover_optimal_radius",
            run_id=cluster["run_id"],
            cluster_number=cluster["cluster_number"],
            education_supervision=supervision,
            needs_tags=needs_tags,
            priority_tags=priority_tags,
            semantic_filter_vector=semantic_filter_vector,
        )

        if not radii_result.get("ok") or not radii_result.get("radii"):
            return (
                "# No Radii Found\n\n"
                f"Could not identify service hubs in cluster "
                f"`{cluster.get('cluster_name')}` (#{cluster['cluster_number']}).\n\n"
                f"Reason: {radii_result.get('error', 'No amenities found within boundary.')}"
            )

        radii: list[dict[str, Any]] = radii_result["radii"]
        logger.info("Discovered %d hub(s). Tags used: %s", len(radii), needs_tags)

        # ── Step 3: Holistic semantic scoring ─────────────────────────────
        _progress(
            "[tactical] Step 3/4: Holistic semantic scoring (pgvector across all amenities)…"
        )
        score_result = await self._call(
            "semantic_radius_scoring",
            radii=radii,
            family_needs_text=needs_text,
            education_supervision=supervision,
        )
        ranked_radii: list[dict[str, Any]] = (
            score_result.get("ranked_radii") or radii
        )

        # ── Step 4: GPT-4o grounded recommendation ────────────────────────
        _progress("[tactical] Step 4/4: Generating GPT-4o recommendation…")
        ai_letter = await _generate_recommendation(family_needs, cluster, ranked_radii)

        report = _format_report(family_needs, cluster, ranked_radii, ai_letter)
        await save_family_response(
            family_id,
            report,
            confidence=cluster.get("confidence"),
            radii_data=ranked_radii,
        )
        return report


# ─── Pipeline entry point ─────────────────────────────────────────────────────


async def run_pipeline(
    family_id: str,
    *,
    server_path: Optional[Path] = None,
    tool_timeout_s: float = 240.0,
    forward_server_stderr: bool = False,
) -> str:
    """Async entry point — loads .env and runs the agent for one family."""
    mcp_dir = Path(__file__).resolve().parent
    load_dotenv(_project_root() / ".env")
    load_dotenv(mcp_dir / ".env")

    async with FamilyTacticalAgent(
        mcp_server_script=server_path,
        tool_timeout_s=tool_timeout_s,
        forward_server_stderr=forward_server_stderr,
    ) as agent:
        return await agent.run(family_id)


# ─── CLI ──────────────────────────────────────────────────────────────────────


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="CityStrata Family Tactical Agent — single-family relocation planner",
    )
    parser.add_argument(
        "--family-id",
        default=os.getenv("TACTICAL_SAMPLE_FAMILY_ID", "").strip(),
        help="Single evacuee_family_profiles.uuid (or set TACTICAL_SAMPLE_FAMILY_ID)",
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
        default=240.0,
        help="Per-tool-call timeout in seconds (default: 240)",
    )
    parser.add_argument(
        "--forward-server-stderr",
        action="store_true",
        help="Pipe mcp_server.py stderr to this terminal (may deadlock on Windows)",
    )
    args = parser.parse_args()

    if not args.family_id:
        print(
            "Error: supply --family-id <uuid> or set TACTICAL_SAMPLE_FAMILY_ID.",
            file=sys.stderr,
        )
        sys.exit(2)

    try:
        report = asyncio.run(
            run_pipeline(
                args.family_id,
                server_path=args.server,
                tool_timeout_s=args.tool_timeout,
                forward_server_stderr=args.forward_server_stderr,
            )
        )
        print(report, flush=True)

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
