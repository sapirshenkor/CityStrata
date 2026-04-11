"""
CityStrata Tactical Agent — Domain-Specific Utilities

Education-phase mappings, holistic needs extraction, report-formatting
helpers, Hebrew labels, AI constants, and culture-frequency helpers used
by both FamilyTacticalAgent and MultiFamilyTacticalAgent.

Separated from ``base_agent.py`` (generic MCP infrastructure) so the
base class remains domain-agnostic and reusable for any MCP agent.
"""

from __future__ import annotations

from typing import Any, Optional


# ─── Generic value coercion ──────────────────────────────────────────────────


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


# ─── AI constants ─────────────────────────────────────────────────────────────

AI_MODEL = "gpt-4o"
AI_TIMEOUT = 65.0  # seconds


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


def needed_education_phases(family_needs: dict[str, Any]) -> list[str]:
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


def aggregate_phase_counts(
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


# ─── Holistic needs helpers ───────────────────────────────────────────────────


def extract_needs_tags(family_needs: dict[str, Any]) -> list[str]:
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

    social_imp = _to_int(
        lifestyle.get("social_venues_importance") or comm.get("social_importance")
    )
    if social_imp >= 3:
        tags.append("cafe")
        tags.append("restaurant")

    culture_freq = _to_int(
        lifestyle.get("culture_frequency") or comm.get("culture_frequency")
    )
    if culture_freq >= 3:
        tags.append("city_facility")

    if (
        medical.get("needs_medical_proximity")
        or _to_int(medical.get("services_importance")) >= 4
    ):
        tags.append("city_facility")

    if not tags:
        tags = [
            "education",
            "synagogue",
            "matnas",
            "cafe",
            "restaurant",
            "city_facility",
        ]

    return list(dict.fromkeys(tags))


def extract_priority_tags(family_needs: dict[str, Any]) -> list[str]:
    """
    Derive deterministic category filters for personalized spatial discovery.

    Uses report relevance as the primary signal, then falls back to
    ``extract_needs_tags`` so callers always get at least one valid category.
    Returned tags are ordered by AMENITY_TABLES category convention.
    """
    ordered = ["education", "synagogue", "matnas", "cafe", "restaurant", "city_facility"]
    rel = relevant_categories(family_needs)
    tags = [cat for cat in ordered if cat in rel]
    if not tags:
        tags = extract_needs_tags(family_needs)
    return list(dict.fromkeys(tags))


def resolve_education_supervision(family_needs: dict[str, Any]) -> Optional[str]:
    """
    Map the family's religious affiliation to the corresponding school
    supervision type in educational_institutions.type_of_supervision.

    DB values (confirmed): "State" (106), "State Religious" (19), "Ultra-Orthodox" (3).
    """
    affiliation = (family_needs.get("religion") or {}).get("affiliation") or ""
    mapping = {
        "secular": "State",
        "religious": "State Religious",
        "traditional": "State Religious",
        "haredi": "Ultra-Orthodox",
    }
    return mapping.get(affiliation.lower())


def build_needs_text(family_needs: dict[str, Any]) -> str:
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

    edu_tags = edu.get("essential_tags") or []
    if edu_tags:
        parts.append(f"education needs: {', '.join(edu_tags)}")
    elif _to_int(edu.get("proximity_importance")) >= 4:
        parts.append("high education proximity importance")

    if rel.get("affiliation"):
        parts.append(f"religious affiliation: {rel['affiliation']}")
    if rel.get("needs_synagogue"):
        parts.append("requires nearby synagogue for daily prayer")

    if comm.get("matnas_participation"):
        parts.append("active matnas (community centre) participation")
    if comm.get("needs_community_proximity"):
        parts.append("needs strong community proximity and social integration")

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

    if medical.get("needs_medical_proximity"):
        parts.append("requires proximity to medical services and clinics")
    if _to_int(medical.get("services_importance")) >= 4:
        parts.append("high importance placed on access to health and city services")

    if mob.get("has_mobility_disability"):
        parts.append(
            "household member with mobility disability — needs accessible area"
        )
    if not mob.get("has_car"):
        parts.append("no private car — walkable neighbourhood preferred")

    notes = family_needs.get("notes")
    if notes:
        parts.append(notes)

    return (
        ". ".join(parts)
        or "Displaced Israeli family seeking holistic relocation in Eilat"
    )


def build_semantic_filter_text(family_needs: dict[str, Any]) -> str:
    """
    Build normalized text for semantic pre-filtering in spatial discovery.

    Currently mirrors ``build_needs_text`` so embedding behavior stays aligned
    between radius personalization and final semantic validation.
    """
    return build_needs_text(family_needs).strip()


# ─── Report formatting helpers ────────────────────────────────────────────────


def relevant_categories(family_needs: dict[str, Any]) -> set[str]:
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


# ─── Hebrew labels ────────────────────────────────────────────────────────────

HUB_LABEL_HE: dict[str, str] = {
    "zone_alpha": "אזור אלפא",
    "zone_beta": "אזור בטא",
    "zone_gamma": "אזור גמא",
}

PHASE_LABELS_HE: dict[str, str] = {
    "kindergarten": "גני ילדים",
    "elementary": "בתי ספר יסודיים",
    "high_school": "בתי ספר תיכוניים",
}


def he_zone_label(hub_label: str) -> str:
    """
    Return the Hebrew-friendly zone name for a hub_label string.

    Known labels (zone_alpha/beta/gamma) map to Hebrew letter names.
    Any other pattern falls back to "אזור <N>" where N is the numeric index
    extracted from the label, or the raw label if no number is present.
    """
    raw = (hub_label or "").strip().lower()
    if raw in HUB_LABEL_HE:
        return HUB_LABEL_HE[raw]
    return raw.replace("zone_", "אזור ").replace("zone ", "אזור ").strip().title()


# ─── Culture frequency helpers ───────────────────────────────────────────────


def culture_rank(value: Any) -> int:
    """Rank culture_frequency for merge: daily > weekly > rarely."""
    s = (str(value or "")).strip().lower()
    if s == "daily":
        return 3
    if s == "weekly":
        return 2
    return 1


def culture_from_rank(rank: int) -> str:
    if rank >= 3:
        return "daily"
    if rank == 2:
        return "weekly"
    return "rarely"
