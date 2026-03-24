"""
CityStrata Tactical Relocation Agent

Orchestrates the three MCP tools into a holistic radius-based relocation
recommendation that considers ALL amenity categories — education, religion,
community, cafes, restaurants, city facilities, and medical services.

Pipeline
--------
1. get_evacuation_context   — full family profile + assigned cluster boundary
2. discover_optimal_radius  — PostGIS K-means hubs across ALL amenities
3. semantic_radius_scoring  — pgvector ranking against holistic family needs
4. GPT-4o generation        — grounded Markdown recommendation report

Usage
-----
    python tactical_agent.py --family-id <uuid>
    TACTICAL_SAMPLE_FAMILY_ID=<uuid> python tactical_agent.py
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# ─── Path helpers ─────────────────────────────────────────────────────────────

def _project_root() -> Path:
    """CityStrata project root (parent of the mcp/ folder)."""
    return Path(__file__).resolve().parent.parent


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


# ─── MCP response decoder ─────────────────────────────────────────────────────

def _decode(result: Any) -> dict[str, Any]:
    """
    Decode an MCP call_tool result into a plain dict.

    FastMCP may return structuredContent (a dict) or a list of text blocks
    containing JSON — both forms are handled here.
    """
    if getattr(result, "isError", False):
        raise RuntimeError(f"MCP tool error: {getattr(result, 'error', 'unknown error')}")

    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured

    chunks: list[str] = []
    for block in getattr(result, "content", []) or []:
        btype = getattr(block, "type", None) or (block.get("type") if isinstance(block, dict) else None)
        text  = getattr(block, "text",  None) or (block.get("text")  if isinstance(block, dict) else None)
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


# ─── GPT-4o grounded recommendation ──────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a Tactical Relocation Expert at CityStrata, specialising in emergency
shelter placement for Israeli families displaced by conflict.

Your task: synthesise spatial and semantic analysis results into a clear,
human-readable recommendation of the best relocation zones (neighbourhoods)
within the family's assigned cluster.

STRICT RULES — follow without exception:
1. Use ONLY the numerical facts in the user message (scores, distances, amenity
   counts). Do not invent, estimate, or assume any data not provided.
2. Recommend up to 3 zones in order of suitability with specific reasoning per
   zone tied to the family's stated needs — education (use education_matched for
   schools that match their supervision type, note education_special if > 0),
   religion, community, lifestyle (cafes / restaurants), medical access, and mobility.
3. Structure: one brief situation summary paragraph, then one paragraph per zone
   explaining concretely why it fits this family, then a short closing paragraph.
4. Write in the language implied by the family name — Hebrew names → Hebrew,
   otherwise English.
5. Tone: warm, empathetic, and professional. Acknowledge the difficulty of
   displacement.
6. Do not add a subject line or sign-off; the output is embedded in a larger
   report.
"""

_AI_MODEL   = "gpt-4o"
_AI_TIMEOUT = 65.0  # seconds


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
    comp      = family_needs.get("composition") or {}
    edu       = family_needs.get("education")   or {}
    rel       = family_needs.get("religion")    or {}
    comm      = family_needs.get("community")   or {}
    mob       = family_needs.get("mobility")    or {}
    lifestyle = family_needs.get("lifestyle")   or {}
    medical   = family_needs.get("medical")     or {}

    return {
        "family_name":    family_needs.get("family_name"),
        "household_size": comp.get("total_people"),
        "children": {
            k: v for k, v in comp.items()
            if k in ("infants", "preschool", "elementary", "youth") and v
        },
        "education": {
            "essential_tags":       edu.get("essential_tags") or [],
            "proximity_importance": edu.get("proximity_importance"),
        },
        "religion": {
            "affiliation":     rel.get("affiliation"),
            "needs_synagogue": rel.get("needs_synagogue"),
        },
        "community": {
            "matnas_participation":      comm.get("matnas_participation"),
            "needs_community_proximity": comm.get("needs_community_proximity"),
            "social_importance":         comm.get("social_importance"),
        },
        "lifestyle": {
            "social_venues_importance": lifestyle.get("social_venues_importance"),
            "culture_frequency":        lifestyle.get("culture_frequency"),
        },
        "medical": {
            "needs_medical_proximity": medical.get("needs_medical_proximity"),
            "services_importance":     medical.get("services_importance"),
        },
        "mobility": {
            "has_car":                mob.get("has_car"),
            "has_mobility_disability": mob.get("has_mobility_disability"),
        },
        "cluster_name":      cluster.get("cluster_name"),
        "cluster_reasoning": cluster.get("reasoning"),
        "education_supervision_filter": ranked_radii[0].get("education_supervision_filter") if ranked_radii else None,
        "recommended_zones": [
            {
                "rank":               i + 1,
                "zone_label":         r.get("hub_label"),
                "center_lat":         r.get("center_lat"),
                "center_lng":         r.get("center_lng"),
                "radius_m":           r.get("radius_m"),
                "semantic_score":     r.get("semantic_score"),
                "embeddings_matched": r.get("embeddings_matched"),
                "total_amenities":    r.get("total_amenities"),
                "amenity_counts":     r.get("amenity_counts") or {},
                # Education building counts (deduplicated at 3dp coordinate precision)
                "education_matched":  r.get("education_matched"),   # schools matching supervision type
                "education_special":  r.get("education_special"),   # special education buildings
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

    context     = _build_grounding_context(family_needs, cluster, ranked_radii)
    user_prompt = (
        "Below are the family profile and the top relocation zones identified by "
        "our holistic spatial and semantic analysis pipeline. "
        "Write your recommendation using ONLY the data provided:\n\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )

    _progress("[tactical] Calling GPT-4o for recommendation…")
    try:
        client   = AsyncOpenAI(api_key=api_key, timeout=_AI_TIMEOUT)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=_AI_MODEL,
                temperature=0.3,    # low → reliable, grounded output
                max_tokens=1_200,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": user_prompt},
                ],
            ),
            timeout=_AI_TIMEOUT + 5,
        )
        letter = (response.choices[0].message.content or "").strip()
        _progress("[tactical] GPT-4o response received.")
        return letter or None

    except Exception as exc:  # non-fatal — fall back to static report
        logger.warning("AI generation failed (non-fatal): %s", exc)
        _progress(f"[tactical] AI generation skipped ({exc}). Continuing with static report.")
        return None


# ─── Holistic needs helpers ───────────────────────────────────────────────────

def _extract_needs_tags(family_needs: dict[str, Any]) -> list[str]:
    """
    Derive holistic amenity-type tags from the full family profile.

    Tags map 1-to-1 with AMENITY_TABLES categories in mcp_server.py.
    All detected needs are included; the fallback is every category so that
    hub discovery always has a complete amenity picture.
    """
    tags: list[str] = []

    edu       = family_needs.get("education")  or {}
    rel       = family_needs.get("religion")   or {}
    comm      = family_needs.get("community")  or {}
    lifestyle = family_needs.get("lifestyle")  or {}
    medical   = family_needs.get("medical")    or {}

    # ── Anchor institutions ────────────────────────────────────────────────
    if edu.get("essential_tags") or _to_int(edu.get("proximity_importance")) >= 3:
        tags.append("education")

    if rel.get("needs_synagogue") or rel.get("affiliation") in (
        "religious", "haredi", "traditional"
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
    if medical.get("needs_medical_proximity") or _to_int(medical.get("services_importance")) >= 4:
        tags.append("city_facility")  # OSM city facilities include clinics

    # Fallback: include every category so hub discovery is always holistic.
    if not tags:
        tags = ["education", "synagogue", "matnas", "cafe", "restaurant", "city_facility"]

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
        "secular":     "State",
        "religious":   "State Religious",
        "traditional": "State Religious",
        "haredi":      "Ultra-Orthodox",
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

    comp      = family_needs.get("composition") or {}
    edu       = family_needs.get("education")   or {}
    rel       = family_needs.get("religion")    or {}
    comm      = family_needs.get("community")   or {}
    lifestyle = family_needs.get("lifestyle")   or {}
    medical   = family_needs.get("medical")     or {}
    mob       = family_needs.get("mobility")    or {}

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
        parts.append("household member with mobility disability — needs accessible area")
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


# ─── Agent ────────────────────────────────────────────────────────────────────

class TacticalRelocationAgent:
    """
    Connects to the CityStrata MCP server over stdio and orchestrates the
    holistic three-step pipeline followed by GPT-4o grounded generation.

    Usage::
        async with TacticalRelocationAgent() as agent:
            report = await agent.run_for_family(family_id)
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
            sys.stderr if forward_server_stderr
            else open(os.devnull, "w", encoding="utf-8")
        )
        self._stack:   Optional[AsyncExitStack] = None
        self._session: Optional[ClientSession]  = None

    # ── Context manager ───────────────────────────────────────────────────

    async def __aenter__(self) -> TacticalRelocationAgent:
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
        self._stack   = None

    # ── Tool call wrapper ─────────────────────────────────────────────────

    async def _call(self, tool: str, **kwargs: Any) -> dict[str, Any]:
        """Call a named MCP tool with keyword arguments and decode the response."""
        assert self._session is not None, "Agent not connected. Use 'async with agent:'."
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

    # ── Pipeline ──────────────────────────────────────────────────────────

    async def run_for_family(self, family_id: str) -> str:
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
            return f"# Error — Context Load Failed\n\n{ctx.get('error', 'Unknown error.')}"

        family_needs: dict[str, Any]      = ctx["family_needs"]
        cluster: Optional[dict[str, Any]] = ctx.get("cluster")

        if not cluster or not cluster.get("run_id"):
            return (
                "# No Cluster Assignment\n\n"
                f"Family `{family_id}` has not been matched to a cluster yet. "
                "Run the macro matching agent first, then link the result."
            )

        # ── Step 2: Holistic K-means hub discovery ────────────────────────
        _progress("[tactical] Step 2/4: Discovering K-means hubs across all amenities…")
        needs_tags  = _extract_needs_tags(family_needs)
        supervision = _resolve_education_supervision(family_needs)
        if supervision:
            _progress(f"[tactical]   Education filter: {supervision} schools only")
        radii_result = await self._call(
            "discover_optimal_radius",
            run_id=cluster["run_id"],
            cluster_number=cluster["cluster_number"],
            education_supervision=supervision,
            needs_tags=needs_tags,
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
        _progress("[tactical] Step 3/4: Holistic semantic scoring (pgvector across all amenities)…")
        needs_text   = _build_needs_text(family_needs)
        score_result = await self._call(
            "semantic_radius_scoring",
            radii=radii,
            family_needs_text=needs_text,
            education_supervision=supervision,
        )
        ranked_radii: list[dict[str, Any]] = (
            score_result.get("ranked_radii") or radii  # fallback to unranked on failure
        )

        # ── Step 4: GPT-4o grounded recommendation ────────────────────────
        _progress("[tactical] Step 4/4: Generating GPT-4o recommendation…")
        ai_letter = await _generate_recommendation(family_needs, cluster, ranked_radii)

        return _format_report(family_needs, cluster, ranked_radii, ai_letter)


# ─── Report formatter ─────────────────────────────────────────────────────────

# Human-readable labels for all amenity categories (mirrors AMENITY_TABLES).
_CATEGORY_LABELS: dict[str, str] = {
    "education":    "Schools / Education",
    "synagogue":    "Synagogues",
    "matnas":       "Community Centres (Matnas)",
    "cafe":         "Cafés",
    "restaurant":   "Restaurants",
    "city_facility": "City Facilities / Parks",
}


def _format_report(
    family_needs: dict[str, Any],
    cluster: dict[str, Any],
    ranked_radii: list[dict[str, Any]],
    ai_letter: Optional[str],
) -> str:
    """Build the final Markdown tactical report from pipeline outputs."""
    name         = family_needs.get("family_name") or "Unknown Family"
    comp         = family_needs.get("composition") or {}
    cluster_name = cluster.get("cluster_name") or f"Cluster {cluster.get('cluster_number')}"

    lines: list[str] = [
        f"# CityStrata Tactical Report — {name}",
        "",
        f"**Assigned cluster:** {cluster_name}  ",
        f"**Household size:** {comp.get('total_people', '?')}  ",
        f"**Cluster confidence:** {cluster.get('confidence', '—')}  ",
        "",
        "---",
        "",
    ]

    # AI-generated recommendation letter (if available)
    if ai_letter:
        lines += ["## AI Recommendation", "", ai_letter, "", "---", ""]

    # Ranked zone cards — full holistic amenity breakdown
    lines += ["## Ranked Relocation Zones", ""]

    for i, zone in enumerate(ranked_radii[:3], start=1):
        counts  = zone.get("amenity_counts") or {}
        label   = (zone.get("hub_label") or "zone").replace("_", " ").title()
        lat     = zone.get("center_lat", 0.0)
        lng     = zone.get("center_lng", 0.0)
        radius  = zone.get("radius_m", 0)
        score   = zone.get("semantic_score", 0.0)
        matched = zone.get("embeddings_matched", 0)
        total   = zone.get("total_amenities", sum(counts.values()))

        education_matched = zone.get("education_matched")
        education_special = zone.get("education_special")
        edu_filter        = zone.get("education_supervision_filter")

        lines += [
            f"### Zone {i} — {label}",
            "",
            "| Field | Value |",
            "|-------|-------|",
            f"| **Centre** | `{lat:.5f}, {lng:.5f}` |",
            f"| **Radius** | {radius} m |",
            f"| **Semantic score** | {score:.4f} ({matched} embeddings matched) |",
            f"| **Total amenities** | {total} |",
        ]

        # Holistic amenity breakdown
        for cat, human_label in _CATEGORY_LABELS.items():
            if cat == "education":
                # Show matched schools (filtered by supervision) + total from UNION ALL
                all_edu = counts.get("education", 0)
                if education_matched is not None and edu_filter:
                    lines.append(
                        f"| **{human_label}** | "
                        f"{education_matched} matching ({edu_filter}) "
                        f"/ {all_edu} total |"
                    )
                else:
                    if all_edu:
                        lines.append(f"| **{human_label}** | {all_edu} |")
                # Special education row — always show if > 0
                if education_special:
                    lines.append(f"| **Special Education Schools** | {education_special} |")
            else:
                count = counts.get(cat, 0)
                if count:
                    lines.append(f"| **{_CATEGORY_LABELS[cat]}** | {count} |")

        lines.append("")

    lines += [
        "---",
        "",
        "*CityStrata Tactical Agent — holistic cluster-bound radius recommendations "
        "for displaced families in Eilat.*",
    ]
    return "\n".join(lines)


# ─── Pipeline entry point ─────────────────────────────────────────────────────

async def run_pipeline(
    family_id: str,
    *,
    server_path: Optional[Path] = None,
    tool_timeout_s: float = 240.0,
    forward_server_stderr: bool = False,
) -> str:
    """Async entry point — loads .env and runs the agent for one family."""
    load_dotenv(_project_root() / ".env")
    load_dotenv(_project_root() / "mcp" / ".env")

    async with TacticalRelocationAgent(
        mcp_server_script=server_path,
        tool_timeout_s=tool_timeout_s,
        forward_server_stderr=forward_server_stderr,
    ) as agent:
        return await agent.run_for_family(family_id)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="CityStrata Tactical Agent — holistic radius-based relocation planner",
    )
    parser.add_argument(
        "--family-id",
        default=os.getenv("TACTICAL_SAMPLE_FAMILY_ID", "").strip(),
        help="evacuee_family_profiles.uuid (or set TACTICAL_SAMPLE_FAMILY_ID)",
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