"""
Cluster matching agent: matches a family profile to the best neighborhood cluster
using OpenAI, with reasoning and placement flags.
"""

import json

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import settings

# OpenAI client; initialized lazily so app can start without key when matching is unused
_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI:
    global _client
    key = settings.openai_api_key
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add OPENAI_API_KEY to your .env file or set the environment variable."
        )
    if _client is None:
        _client = AsyncOpenAI(api_key=key)
    return _client


# ---------------------------------------------------------------------------
# Family profile (input)
# ---------------------------------------------------------------------------


class ChildrenAges(BaseModel):
    """Number of children in each age band."""

    infants: int = 0      # 0–3
    preschool: int = 0    # 3–6
    elementary: int = 0   # 6–12
    youth: int = 0        # 12–18


class FamilyProfile(BaseModel):
    """Family profile used for cluster matching."""

    # Composition
    total_people: int
    children_ages: ChildrenAges
    seniors: int = 0
    has_mobility_disability: bool = False

    # Mobility
    has_car: bool = True

    # Religious & cultural
    religious_affiliation: str  # secular / traditional / religious / haredi
    needs_synagogue: bool = False
    matnas_participation: bool = False

    # Priorities (1–5)
    education_proximity_importance: int = 3
    social_venues_importance: int = 3
    services_importance: int = 3

    # Accommodation
    accommodation_preference: str = "airbnb"  # airbnb / hotel
    needs_medical_proximity: bool = False


# ---------------------------------------------------------------------------
# Cluster profile (from DB / clustering)
# ---------------------------------------------------------------------------


class ClusterDimensions(BaseModel):
    """Dimension levels per cluster (very_high, high, medium, low, very_low)."""

    education: str
    tourism: str
    food: str
    community: str
    osm_infra: str
    religious: str


class ClusterProfile(BaseModel):
    """One cluster's profile with name, description, and dimensions."""

    cluster: int
    name: str
    short_description: str
    dimensions: ClusterDimensions


# ---------------------------------------------------------------------------
# Agent response (output)
# ---------------------------------------------------------------------------


class Agent1Response(BaseModel):
    """Response from the cluster matching agent."""

    recommended_cluster: str
    confidence: str  # high / medium / low
    reasoning: str
    alternative_cluster: str
    alternative_reasoning: str
    flags: list[str]  # critical constraints for placement officer


# ---------------------------------------------------------------------------
# Helpers: format inputs for the LLM prompt
# ---------------------------------------------------------------------------


def _format_family_profile_text(family: FamilyProfile) -> str:
    """
    Convert the family profile into readable natural language for the prompt.
    Omits children/seniors if counts are zero.
    """
    parts = [f"The family has {family.total_people} members."]

    c = family.children_ages
    has_children = c.infants or c.preschool or c.elementary or c.youth
    if has_children:
        segs = []
        if c.infants:
            segs.append(f"{c.infants} infant(s)" if c.infants > 1 else "1 infant")
        if c.preschool:
            segs.append(f"{c.preschool} preschool child/children" if c.preschool > 1 else "1 preschool child")
        if c.elementary:
            segs.append(f"{c.elementary} elementary school child/children" if c.elementary > 1 else "1 elementary school child")
        if c.youth:
            segs.append(f"{c.youth} youth" if c.youth > 1 else "1 youth")
        parts.append(" Including " + ", ".join(segs) + ".")

    if family.seniors > 0:
        parts.append(f" {family.seniors} senior(s)." if family.seniors > 1 else " 1 senior.")

    aff = family.religious_affiliation
    parts.append(f" They are {aff}.")
    if family.needs_synagogue:
        parts.append(" They require proximity to a synagogue.")
    if not family.has_car:
        parts.append(" They do not own a car and rely on public transport.")
    else:
        parts.append(" They have a car.")

    parts.append(
        f" Education proximity importance: {family.education_proximity_importance}/5."
    )
    parts.append(
        f" Social venues importance: {family.social_venues_importance}/5."
    )
    parts.append(
        f" Daily services accessibility importance: {family.services_importance}/5."
    )

    if family.matnas_participation:
        parts.append(" They previously participated in matnas community activities.")

    acc = family.accommodation_preference
    parts.append(f" They prefer {acc} accommodation.")
    if family.needs_medical_proximity:
        parts.append(" They need medical services nearby.")

    if family.has_mobility_disability:
        parts.append(" A member has mobility disability; accessibility is critical.")

    return "".join(parts).strip()


def _format_cluster_profiles_text(clusters: list[ClusterProfile]) -> str:
    """Format cluster profiles as readable text for the prompt."""
    lines = []
    for p in clusters:
        d = p.dimensions
        dims = (
            f"education={d.education}, tourism={d.tourism}, food={d.food}, "
            f"community={d.community}, osm_infra={d.osm_infra}, religious={d.religious}"
        )
        lines.append(
            f"Cluster: {p.name}\n"
            f"Description: {p.short_description}\n"
            f"Dimensions: {dims}"
        )
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# System prompt: role + matching rules
# ---------------------------------------------------------------------------

MATCHING_SYSTEM_PROMPT = """You are a placement officer assistant for neighborhood matching in Eilat, Israel. Your task is to recommend the best neighborhood cluster for a displaced family based on their profile and the available cluster profiles.

Apply these matching rules:
- Religious / haredi affiliation → Prioritize high "religious" dimension.
- No car OR mobility disability → Prioritize high "osm_infra" (bus stops and transport density from OSM data).
- Preschool / elementary children → Prioritize high "education" dimension.
- Matnas participation → Prioritize high "community" dimension.
- Hotel accommodation preference → Prioritize "Commercial Core" cluster.
- Airbnb accommodation preference → Prioritize high "tourism" dimension.
- Medical needs → Prioritize high "osm_infra".
- social_venues_importance 4–5 → Prioritize high "food" dimension.
- "Peripheral - Sparse" → Recommend only as absolute last resort; always flag it explicitly.

Return exactly one JSON object with these keys (no markdown, no backticks, no preamble): recommended_cluster (string, one of the cluster names), confidence (string: "high" | "medium" | "low"), reasoning (string), alternative_cluster (string), alternative_reasoning (string), flags (array of strings; critical constraints for the placement officer)."""


async def match_family_to_cluster(
    family_profile: FamilyProfile,
    cluster_profiles: list[ClusterProfile],
) -> Agent1Response:
    """
    Call OpenAI to match a family profile to the best cluster; return
    recommended cluster, confidence, reasoning, alternative, and flags.
    """
    family_text = _format_family_profile_text(family_profile)
    clusters_text = _format_cluster_profiles_text(cluster_profiles)

    user_content = (
        "Family profile:\n"
        f"{family_text}\n\n"
        "Available clusters:\n"
        f"{clusters_text}\n\n"
        "Return ONLY a valid JSON object with keys: recommended_cluster, confidence, reasoning, alternative_cluster, alternative_reasoning, flags. No markdown, no backticks, no extra text."
    )

    try:
        response = await _get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": MATCHING_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=1000,
            temperature=0,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        raise RuntimeError(f"OpenAI API call failed: {e}") from e

    raw = response.choices[0].message.content
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Agent returned invalid JSON: {e}. Raw response: {raw!r}") from e

    return Agent1Response(
        recommended_cluster=data["recommended_cluster"],
        confidence=data["confidence"],
        reasoning=data["reasoning"],
        alternative_cluster=data["alternative_cluster"],
        alternative_reasoning=data["alternative_reasoning"],
        flags=data.get("flags", []) if isinstance(data.get("flags"), list) else [],
    )
