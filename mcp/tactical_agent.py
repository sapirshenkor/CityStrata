"""
CityStrata Tactical Relocation Agent

Bridges macro cluster assignment to concrete housing options by calling the
CityStrata MCP server tools (``mcp_server.py``) over stdio — no direct DB access.

Pipeline
--------
1. ``get_family_tactical_context``   — load profile + cluster anchor.
2. ``search_nearby_amenities``       — discover Airbnb + hotel candidates.
3. ``calculate_location_score``      — parallel scoring with bounded concurrency.
4. ``gpt-4o`` generation             — grounded recommendation letter from DB facts.
5. Markdown report                   — sorted by score DESC, then cluster distance ASC.

Usage
-----
    python tactical_agent.py --family-id <uuid>
    # or
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
from typing import Any, Optional, TextIO

from openai import AsyncOpenAI
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)

# On Windows, forwarding the MCP child's stderr through the pipe can deadlock
# if nothing drains it.  Discard by default; use --forward-server-stderr to opt in.
_MCP_SERVER_STDERR_SINK: TextIO = open(os.devnull, "w", encoding="utf-8")


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------


def _project_root() -> Path:
    """Return the CityStrata project root (parent of the ``mcp/`` folder)."""
    return Path(__file__).resolve().parent.parent


def _default_server_path() -> Path:
    """Return the default ``mcp_server.py`` path (same directory as this file)."""
    return (Path(__file__).resolve().parent / "mcp_server.py").resolve()


# ---------------------------------------------------------------------------
# Progress reporting
# ---------------------------------------------------------------------------


def _progress(msg: str) -> None:
    """Print a progress line to stderr (stdout is reserved for the final report)."""
    print(msg, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Pre-flight smoke test
# ---------------------------------------------------------------------------


async def _smoke_openai_and_db() -> None:
    """Verify OpenAI connectivity and Postgres access before spawning the MCP child.

    Runs both checks in the parent process so failures are surfaced cleanly,
    separate from any MCP transport issues.  Uses stdlib ``urllib`` (not httpx)
    to match the server's behaviour on Windows.

    Raises:
        RuntimeError: If ``DATABASE_URL`` or ``OPENAI_API_KEY`` are missing,
            or if either service is unreachable within the timeout.
    """
    _progress("[tactical] Pre-flight: OpenAI embedding + Postgres (loads project .env)…")
    root = _project_root()
    load_dotenv(root / ".env")
    load_dotenv(root / "mcp" / ".env")

    dsn = os.getenv("DATABASE_URL", "").strip()
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not dsn:
        raise RuntimeError("DATABASE_URL missing. Add it to the project .env (same as backend).")
    if not key:
        raise RuntimeError("OPENAI_API_KEY missing. Add it to the project .env.")

    def _openai_ping_sync() -> None:
        import json as _json
        import urllib.request

        payload = _json.dumps(
            {"model": "text-embedding-3-small", "input": "ping"}
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://api.openai.com/v1/embeddings",
            data=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            _json.loads(resp.read())

    loop = asyncio.get_running_loop()
    await asyncio.wait_for(loop.run_in_executor(None, _openai_ping_sync), timeout=35.0)
    _progress("[tactical] Pre-flight: OpenAI OK")

    import asyncpg  # imported here to keep top-level imports minimal

    conn = await asyncpg.connect(dsn=dsn, timeout=30, command_timeout=30, statement_cache_size=0)
    try:
        await conn.execute("SELECT 1")
    finally:
        await conn.close()
    _progress("[tactical] Pre-flight: Postgres OK")


# ---------------------------------------------------------------------------
# MCP payload parsing
# ---------------------------------------------------------------------------


def _parse_tool_payload(result: Any) -> dict[str, Any]:
    """Decode an MCP ``call_tool`` result into a plain dict.

    FastMCP may return either ``structuredContent`` (a dict) or a list of
    text content blocks containing JSON.  Both forms are handled here.

    Args:
        result: The raw object returned by ``ClientSession.call_tool``.

    Returns:
        A plain ``dict``.

    Raises:
        RuntimeError: If the MCP server itself returned an error.
    """
    if getattr(result, "isError", False):
        msg = getattr(result, "error", None) or "Unknown tool error"
        raise RuntimeError(f"MCP tool error: {msg}")

    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured

    chunks: list[str] = []
    for block in getattr(result, "content", []) or []:
        btype = getattr(block, "type", None) or (block.get("type") if isinstance(block, dict) else None)
        if btype == "text":
            text = getattr(block, "text", None) or (block.get("text") if isinstance(block, dict) else None)
            if text:
                chunks.append(str(text))
        elif isinstance(block, dict) and "text" in block:
            chunks.append(str(block["text"]))

    raw = "".join(chunks).strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {"value": data}
    except json.JSONDecodeError:
        return {"_raw_text": raw}


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def _fmt_distance_km(km: Optional[float]) -> str:
    """Format a distance in km for human display.

    Args:
        km: Distance in kilometres, or ``None``.

    Returns:
        ``"~NNN m"`` for sub-km values, ``"~N.NN km"`` otherwise,
        or ``"unknown distance"`` if *km* is ``None``.
    """
    if km is None:
        return "unknown distance"
    return f"~{int(round(km * 1000))} m" if km < 1.0 else f"~{km:.2f} km"


def _tiebreak_distance_km(row: dict[str, Any]) -> float:
    """Extract the cluster-centre distance used for sort tiebreaking.

    Prefers the scoring-tool metric (``metrics.distance_km_from_cluster_center``)
    because it is computed by the same haversine formula as the cluster penalty.
    Falls back to the discovery-phase distance if the metric is absent.

    Args:
        row: A scored candidate dict containing ``score_payload`` and
            optionally ``distance_km_from_cluster_center``.

    Returns:
        Distance in km, or ``float("inf")`` if unavailable (sorts last).
    """
    metrics = (row.get("score_payload") or {}).get("metrics") or {}
    d = metrics.get("distance_km_from_cluster_center")
    if d is not None:
        return float(d)
    d2 = row.get("distance_km_from_cluster_center")
    return float(d2) if d2 is not None else float("inf")


# ---------------------------------------------------------------------------
# AI grounded generation (gpt-4o)
# ---------------------------------------------------------------------------

_AI_SYSTEM_PROMPT = """\
You are a compassionate relocation officer at CityStrata, helping Israeli families \
displaced by conflict find temporary housing in Eilat. Your role is to write a warm, \
personal recommendation letter to the family summarising the top 3 housing options \
identified for them.

STRICT RULES — you must follow all of these without exception:
1. Use ONLY the factual data provided in the user message (scores, distances, school \
counts, listing names, addresses). Do not invent, estimate, or embellish any numbers.
2. Do not mention any amenity, school, synagogue, or community centre that is not \
explicitly listed in the data.
3. Do not alter any distance or score. If a distance says 137 m, write 137 m.
4. Write in a warm, human tone that acknowledges the difficulty of displacement while \
offering practical reassurance grounded in the data.
5. Address the family by name.
6. Structure: one opening paragraph acknowledging the situation, then one paragraph per \
listing (3 total) explaining concretely why it fits their specific needs, then a brief \
closing paragraph.
7. Write in the same language the family name implies (Hebrew names → write in Hebrew; \
otherwise English). When in doubt, write in Hebrew.
8. Do not add a subject line or sign-off — the output will be embedded in a larger report.
"""

_AI_GENERATION_TIMEOUT_S = 60.0
_AI_MODEL = "gpt-4o"


def _build_grounding_context(
    family_needs: dict[str, Any],
    top_scored: list[dict[str, Any]],
) -> dict[str, Any]:
    """Serialise the hard DB facts needed for the AI prompt.

    Only numbers and labels that come directly from the MCP tools are included.
    This is the anti-hallucination boundary: the model receives exactly this dict
    and nothing else — it cannot invent data that isn't here.

    Args:
        family_needs: The ``family_needs`` dict from ``get_family_tactical_context``.
        top_scored: The top-3 scored candidate dicts (each containing ``score_payload``).

    Returns:
        A plain dict that will be serialised to JSON in the prompt.
    """
    comp = family_needs.get("composition") or {}
    edu  = family_needs.get("education") or {}
    rel  = family_needs.get("religious_and_culture") or {}
    comm = family_needs.get("community_and_social") or {}

    listings_data = []
    for rank, row in enumerate(top_scored, start=1):
        sp      = row.get("score_payload") or {}
        metrics = sp.get("metrics") or {}
        listing = sp.get("listing") or {}
        listings_data.append({
            "rank": rank,
            "label": listing.get("label") or row.get("label") or "—",
            "address": listing.get("address") or row.get("address") or "—",
            "table": row.get("listing_table"),
            "score_out_of_10": sp.get("score_out_of_10"),
            "distance_from_cluster_center_km": metrics.get("distance_km_from_cluster_center"),
            "nearest_synagogue_km": metrics.get("nearest_synagogue_km"),
            "nearest_matnas_km": metrics.get("nearest_matnas_km"),
            "schools_total_nearby": metrics.get("schools_total_nearby"),
            "schools_tag_matches": metrics.get("schools_tag_matches_nearby"),
            "schools_radius_km": metrics.get("schools_radius_km"),
            "score_breakdown": sp.get("breakdown") or [],
        })

    return {
        "family_name": family_needs.get("family_name"),
        "household_size": comp.get("total_people"),
        "children": {
            "infants": comp.get("infants", 0),
            "preschool": comp.get("preschool", 0),
            "elementary": comp.get("elementary", 0),
            "youth": comp.get("youth", 0),
        },
        "essential_education": edu.get("essential_education") or [],
        "education_importance": edu.get("education_proximity_importance"),
        "religious_affiliation": rel.get("religious_affiliation"),
        "needs_synagogue": rel.get("needs_synagogue"),
        "matnas_participation": comm.get("matnas_participation"),
        "top_3_listings": listings_data,
    }


async def _generate_ai_recommendation(
    family_needs: dict[str, Any],
    top_scored: list[dict[str, Any]],
) -> Optional[str]:
    """Call ``gpt-4o`` to write a grounded recommendation letter.

    The model receives only the hard DB facts serialised by
    ``_build_grounding_context`` — no free-form context that could encourage
    hallucination. If the call fails for any reason the function returns
    ``None`` so the caller can fall back to the static report.

    Args:
        family_needs: The ``family_needs`` dict from ``get_family_tactical_context``.
        top_scored: The top-3 scored candidate dicts.

    Returns:
        The generated letter as a plain string, or ``None`` on any failure.
    """
    if not top_scored:
        return None

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        logger.warning("AI generation skipped: OPENAI_API_KEY not set.")
        return None

    context = _build_grounding_context(family_needs, top_scored[:3])
    user_message = (
        "Here is the family profile and the top 3 housing options identified by our "
        "spatial scoring system. Write the recommendation letter using ONLY this data:\n\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )

    _progress("[tactical] Step 4/5: generating AI recommendation letter (gpt-4o)…")
    try:
        client = AsyncOpenAI(api_key=api_key, timeout=_AI_GENERATION_TIMEOUT_S)
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=_AI_MODEL,
                temperature=0.4,   # low — we want reliability over creativity
                max_tokens=900,
                messages=[
                    {"role": "system", "content": _AI_SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message},
                ],
            ),
            timeout=_AI_GENERATION_TIMEOUT_S + 5,
        )
        letter = response.choices[0].message.content or ""
        _progress("[tactical] Step 4/5: AI letter generated.")
        return letter.strip() or None
    except Exception as exc:  # noqa: BLE001 — intentional broad catch for graceful fallback
        logger.warning("AI recommendation generation failed (non-fatal): %s", exc)
        _progress(f"[tactical] Step 4/5: AI generation failed ({exc}), continuing with static report.")
        return None


# ---------------------------------------------------------------------------
# Discovery query builders
# ---------------------------------------------------------------------------


def _build_discovery_queries(
    pref: str,
    center_lat: float,
    center_lng: float,
    radius_km: float,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build ``search_nearby_amenities`` argument dicts for Airbnb and hotels.

    Query text is adjusted based on *pref* (``"airbnb"`` or ``"hotel"``) so the
    embedding vector reflects the family's primary accommodation preference.

    Args:
        pref: Normalised ``accommodation_preference`` value from the family profile.
        center_lat: Cluster centre latitude (WGS84).
        center_lng: Cluster centre longitude (WGS84).
        radius_km: Search radius in km.

    Returns:
        ``(airbnb_args, hotels_args)`` — each a dict ready for ``_call_tool_timed``.
    """
    if pref == "hotel":
        airbnb_query = (
            "Alternative apartment-style stay if hotel full: serviced apartment "
            "for families near city amenities in Eilat."
        )
        hotel_query = (
            "Hotel or resort accommodation priority: family suite, breakfast, "
            "central or accessible location in Eilat."
        )
    else:
        airbnb_query = (
            "Furnished vacation rental or Airbnb apartment for a displaced family, "
            "quiet neighborhood, suitable for children, short to medium stay in Eilat."
        )
        hotel_query = (
            "Family-friendly hotel or resort in Eilat, comfortable rooms or suite, "
            "good location for tourists and relocated families."
        )

    shared = {"center_lat": center_lat, "center_lng": center_lng, "radius_km": radius_km}
    return (
        {"query_text": airbnb_query, "table_name": "airbnb_listings", **shared},
        {"query_text": hotel_query,  "table_name": "hotels_listings",  **shared},
    )


# ---------------------------------------------------------------------------
# Main agent class
# ---------------------------------------------------------------------------


class TacticalRelocationAgent:
    """Data-driven tactical planner that communicates exclusively via MCP tools.

    Connects to ``mcp_server.py`` via stdio (the same channel used by Cursor),
    then executes the four-step pipeline:

    1. Load family context and macro cluster anchor.
    2. Discover Airbnb and hotel candidates within the configured radius.
    3. Score every candidate in parallel (bounded by ``score_concurrency``).
    4. Build and return a Markdown tactical report.

    Args:
        mcp_server_script: Path to ``mcp_server.py``. Defaults to the sibling file.
        discovery_radius_km: Radius (km) for ``search_nearby_amenities`` (default 2.5).
        python_executable: Python interpreter to use for the child process.
        tool_timeout_s: Per-call timeout in seconds (default 240).
        score_concurrency: Maximum parallel ``calculate_location_score`` calls (default 4).
        forward_server_stderr: If ``True``, pipe server stderr to this terminal.
            Disabled by default to avoid Windows pipe deadlocks.
    """

    def __init__(
        self,
        mcp_server_script: Optional[Path] = None,
        *,
        discovery_radius_km: float = 2.5,
        python_executable: Optional[str] = None,
        tool_timeout_s: float = 240.0,
        score_concurrency: int = 4,
        forward_server_stderr: bool = False,
    ) -> None:
        self._server_path = (mcp_server_script or _default_server_path()).resolve()
        if not self._server_path.is_file():
            raise FileNotFoundError(f"MCP server script not found: {self._server_path}")

        self.discovery_radius_km = discovery_radius_km
        self._python = python_executable or sys.executable
        self.tool_timeout_s = tool_timeout_s
        self.score_concurrency = max(1, score_concurrency)
        self._mcp_errlog: TextIO = sys.stderr if forward_server_stderr else _MCP_SERVER_STDERR_SINK
        self._stack: Optional[AsyncExitStack] = None
        self._session: Optional[ClientSession] = None

    # ------------------------------------------------------------------
    # Context manager / connection lifecycle
    # ------------------------------------------------------------------

    @property
    def session(self) -> ClientSession:
        """Active MCP ``ClientSession``.

        Raises:
            RuntimeError: If the agent has not been connected yet.
        """
        if self._session is None:
            raise RuntimeError("Agent is not connected; use 'async with agent:'")
        return self._session

    async def __aenter__(self) -> TacticalRelocationAgent:
        await self.connect()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def connect(self) -> None:
        """Spawn the MCP server child process and initialise the session."""
        if self._session is not None:
            return
        self._stack = AsyncExitStack()
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        server_params = StdioServerParameters(
            command=self._python,
            args=[str(self._server_path)],
            env=env,
            cwd=str(_project_root()),
        )
        read, write = await self._stack.enter_async_context(
            stdio_client(server_params, errlog=self._mcp_errlog)
        )
        self._session = await self._stack.enter_async_context(ClientSession(read, write))
        await self._session.initialize()
        logger.info("Connected to MCP server: %s", self._server_path)
        _progress(f"[tactical] Connected to MCP server (timeouts: {self.tool_timeout_s}s per tool call).")

    async def close(self) -> None:
        """Tear down the MCP session and child process."""
        if self._stack is not None:
            await self._stack.aclose()
            self._stack = None
        self._session = None

    # ------------------------------------------------------------------
    # Tool call wrappers
    # ------------------------------------------------------------------

    async def _call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Call an MCP tool and decode the response.

        Args:
            name: Tool name as registered in ``mcp_server.py``.
            arguments: Keyword arguments for the tool.

        Returns:
            Decoded response dict.
        """
        return _parse_tool_payload(await self.session.call_tool(name, arguments))

    async def _call_tool_timed(
        self,
        name: str,
        arguments: dict[str, Any],
        *,
        timeout_s: Optional[float] = None,
    ) -> dict[str, Any]:
        """Call an MCP tool with a timeout, logging progress to stderr.

        Args:
            name: Tool name.
            arguments: Tool keyword arguments.
            timeout_s: Override timeout in seconds (uses ``self.tool_timeout_s`` if omitted).

        Returns:
            Decoded response dict.

        Raises:
            TimeoutError: If the tool call exceeds the timeout.
        """
        t = timeout_s if timeout_s is not None else self.tool_timeout_s
        _progress(f"[tactical] → {name} …")
        try:
            return await asyncio.wait_for(self._call_tool(name, arguments), timeout=t)
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"MCP tool {name!r} timed out after {t}s. "
                "Check DATABASE_URL (network/SSL/VPN), OpenAI API, or increase --tool-timeout."
            ) from exc

    # ------------------------------------------------------------------
    # Pipeline steps
    # ------------------------------------------------------------------

    async def _step_load_context(self, family_id: str) -> dict[str, Any]:
        """Step 1 — Load family profile and macro cluster context.

        Args:
            family_id: ``evacuee_family_profiles.uuid`` string.

        Returns:
            Raw ``get_family_tactical_context`` tool response.
        """
        _progress("[tactical] Step 1/5: loading family + macro cluster context…")
        result = await self._call_tool_timed("get_family_tactical_context", {"family_id": family_id})
        _progress("[tactical] Step 1/5: done.")
        return result

    async def _step_discover_listings(
        self, pref: str, center_lat: float, center_lng: float
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Step 2 — Sequential discovery of Airbnb and hotel candidates.

        Sequential (not parallel) to keep the MCP stdio stack stable.

        Args:
            pref: Normalised ``accommodation_preference`` from the family profile.
            center_lat: Cluster centre latitude.
            center_lng: Cluster centre longitude.

        Returns:
            ``(airbnb_result, hotels_result)`` — raw tool responses.
        """
        airbnb_args, hotels_args = _build_discovery_queries(
            pref, center_lat, center_lng, self.discovery_radius_km
        )
        _progress(
            "[tactical] Step 2/5: discovering Airbnb listings "
            "(OpenAI embedding + PostGIS/pgvector; first call can take ~15–90s)…"
        )
        airbnb_res = await self._call_tool_timed("search_nearby_amenities", airbnb_args)
        _progress("[tactical] Step 2/5: discovering hotels…")
        hotels_res = await self._call_tool_timed("search_nearby_amenities", hotels_args)
        _progress("[tactical] Step 2/5: done.")
        return airbnb_res, hotels_res

    async def _step_score_candidates(
        self, candidates: list[dict[str, Any]], family_id: str
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """Step 3 — Score each candidate with bounded parallel concurrency.

        Args:
            candidates: List of candidate dicts from step 2.
            family_id: ``evacuee_family_profiles.uuid`` string.

        Returns:
            ``(scored, warnings)`` where *scored* contains candidates enriched
            with ``score_payload`` and *warnings* contains error messages for
            any failed scoring calls.
        """
        _progress(
            f"[tactical] Step 3/5: scoring {len(candidates)} listing(s) "
            f"(concurrency={self.score_concurrency})…"
        )
        sem = asyncio.Semaphore(self.score_concurrency)
        score_timeout = min(120.0, self.tool_timeout_s)

        async def _score_one(c: dict[str, Any]) -> Any:
            async with sem:
                return await self._call_tool_timed(
                    "calculate_location_score",
                    {
                        "listing_id": c["listing_id"],
                        "listing_table": c["listing_table"],
                        "family_id": family_id,
                    },
                    timeout_s=score_timeout,
                )

        outcomes = await asyncio.gather(
            *[_score_one(c) for c in candidates], return_exceptions=True
        )
        _progress("[tactical] Step 3/5: done.")

        scored: list[dict[str, Any]] = []
        warnings: list[str] = []
        for cand, outcome in zip(candidates, outcomes):
            ref = f"{cand['listing_table']}/{cand['listing_id']}"
            if isinstance(outcome, BaseException):
                warnings.append(f"Scoring failed for {ref}: {outcome}")
            elif not outcome.get("ok", False):
                warnings.append(
                    f"calculate_location_score not ok for {ref}: {outcome.get('error', outcome)}"
                )
            else:
                scored.append({**cand, "score_payload": outcome})

        # Sort: score DESC, then distance to cluster centre ASC (tiebreaker).
        scored.sort(
            key=lambda x: (
                -float((x.get("score_payload") or {}).get("score_out_of_10") or 0.0),
                _tiebreak_distance_km(x),
            )
        )
        return scored, warnings

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    async def run_for_family(self, family_id: str) -> str:
        """Execute the full four-step tactical pipeline.

        Args:
            family_id: ``evacuee_family_profiles.uuid`` as a string.

        Returns:
            A Markdown-formatted tactical report.
        """
        family_id = str(family_id).strip()

        # Step 1 — context
        ctx = await self._step_load_context(family_id)
        if not ctx.get("ok", False):
            return self._report_no_context(family_id, ctx)

        family_needs: dict[str, Any] = ctx.get("family_needs") or {}
        matching: Optional[dict[str, Any]] = ctx.get("matching_result")
        cluster_center: Optional[dict[str, Any]] = ctx.get("cluster_center")
        warnings: list[str] = list(ctx.get("warnings") or [])

        lat = (cluster_center or {}).get("center_lat")
        lng = (cluster_center or {}).get("center_lng")
        if not cluster_center or lat is None or lng is None:
            return self._report_no_anchor(family_id, family_needs, matching, warnings)

        center_lat, center_lng = float(lat), float(lng)

        # Step 2 — discovery
        housing = family_needs.get("housing") or {}
        pref = (housing.get("accommodation_preference") or "airbnb").lower()
        airbnb_res, hotels_res = await self._step_discover_listings(pref, center_lat, center_lng)

        candidates: list[dict[str, Any]] = []
        for table_key, res in (("airbnb_listings", airbnb_res), ("hotels_listings", hotels_res)):
            if not res.get("ok", False):
                warnings.append(f"search_nearby_amenities failed for {table_key}: {res}")
                continue
            for row in res.get("results") or []:
                lid = row.get("listing_id")
                if lid:
                    candidates.append({
                        "listing_id": str(lid),
                        "listing_table": table_key,
                        "label": row.get("label") or "",
                        "address": row.get("address") or "",
                        "distance_km_from_cluster_center": row.get("distance_km"),
                        "cosine_distance": row.get("cosine_distance"),
                    })

        if not candidates:
            return self._report_no_listings(
                family_id, family_needs, matching, cluster_center, warnings, airbnb_res, hotels_res
            )

        # Step 3 — scoring
        scored, score_warnings = await self._step_score_candidates(candidates, family_id)
        warnings.extend(score_warnings)

        # Step 4 — AI grounded generation (graceful fallback to None on failure)
        ai_letter = await _generate_ai_recommendation(family_needs, scored[:3])

        # Step 5 — report
        _progress("[tactical] Step 5/5: building Markdown report…")
        return self._build_markdown_report(
            family_id=family_id,
            family_needs=family_needs,
            matching=matching,
            cluster_center=cluster_center,
            center_lat=center_lat,
            center_lng=center_lng,
            candidates=candidates,
            scored=scored,
            warnings=warnings,
            ai_letter=ai_letter,
        )

    # ------------------------------------------------------------------
    # Fallback reports
    # ------------------------------------------------------------------

    def _report_no_context(self, family_id: str, ctx: dict[str, Any]) -> str:
        """Return a minimal error report when the family profile cannot be loaded."""
        err = ctx.get("error", "Unknown error")
        return "\n".join([
            "# CityStrata Tactical Match Report",
            "",
            f"**Family ID:** `{family_id}`",
            "",
            "## Status",
            "",
            f"Could not load tactical context: **{err}**",
            "",
            "_The Tactical Agent needs a valid `evacuee_family_profiles.uuid` and, "
            "ideally, a macro matching result linked via `selected_matching_result_id`._",
        ])

    def _report_no_anchor(
        self,
        family_id: str,
        family_needs: dict[str, Any],
        matching: Optional[dict[str, Any]],
        warnings: list[str],
    ) -> str:
        """Return a report explaining that no cluster anchor is available."""
        lines = [
            "# CityStrata Tactical Match Report",
            "",
            f"**Family:** {family_needs.get('family_name', 'Unknown')} (`{family_id}`)",
            "",
            "## Status",
            "",
            "**No usable cluster anchor** — missing `cluster_center` (lat/lng).",
            "",
            "This usually means:",
            "- `selected_matching_result_id` is not set on the profile yet, or",
            "- the matching result has no `run_id` / cluster number, or",
            "- no statistical areas were found for that cluster.",
            "",
        ]
        if matching:
            lines += [
                "### Macro assignment (partial)",
                "",
                f"- **Recommended cluster:** {matching.get('recommended_cluster')}",
                f"- **Confidence:** {matching.get('confidence')}",
                "",
            ]
        if warnings:
            lines.append("### Warnings")
            lines += [f"- {w}" for w in warnings]
        lines += [
            "",
            "_Next step: run the macro matching flow and persist `selected_matching_result_id`, "
            "then re-run tactical discovery._",
        ]
        return "\n".join(lines)

    def _report_no_listings(
        self,
        family_id: str,
        family_needs: dict[str, Any],
        matching: Optional[dict[str, Any]],
        cluster_center: dict[str, Any],
        warnings: list[str],
        airbnb_res: dict[str, Any],
        hotels_res: dict[str, Any],
    ) -> str:
        """Return a report explaining that no listings were found within the radius."""
        lines = [
            "# CityStrata Tactical Match Report",
            "",
            f"**Family:** {family_needs.get('family_name', 'Unknown')} (`{family_id}`)",
            "",
            "## Cluster anchor",
            "",
            f"- **Center (approx.):** `{cluster_center.get('center_lat')}, {cluster_center.get('center_lng')}`",
            f"- **Areas used in centroid:** {cluster_center.get('areas_used', '—')}",
            "",
            "## Discovery",
            "",
            f"No listings with embeddings were found within **{self.discovery_radius_km} km** "
            "of the cluster center in `airbnb_listings` or `hotels_listings`.",
            "",
            "### Raw search counts",
            "",
            f"- **Airbnb tool:** count={airbnb_res.get('count', '—')}, ok={airbnb_res.get('ok')}",
            f"- **Hotels tool:** count={hotels_res.get('count', '—')}, ok={hotels_res.get('ok')}",
            "",
        ]
        if matching:
            lines += ["## Macro context", "", f"- **Cluster:** {matching.get('recommended_cluster')}", ""]
        if warnings:
            lines.append("## Warnings")
            lines += [f"- {w}" for w in warnings]
        lines += [
            "",
            "_Hint: confirm `embedding` is populated (vector ingestion) and listings exist "
            "near this cluster._",
        ]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Main report builder
    # ------------------------------------------------------------------

    def _build_markdown_report(
        self,
        *,
        family_id: str,
        family_needs: dict[str, Any],
        matching: Optional[dict[str, Any]],
        cluster_center: dict[str, Any],
        center_lat: float,
        center_lng: float,
        candidates: list[dict[str, Any]],
        scored: list[dict[str, Any]],
        warnings: list[str],
        ai_letter: Optional[str] = None,
    ) -> str:
        """Assemble the full Markdown tactical report.

        Args:
            family_id: Profile UUID string.
            family_needs: Nested dict from ``get_family_tactical_context``.
            matching: Macro matching result dict, or ``None``.
            cluster_center: Cluster centre metadata dict.
            center_lat: Cluster centre latitude.
            center_lng: Cluster centre longitude.
            candidates: All discovered listing candidates.
            scored: Candidates enriched with ``score_payload``, sorted.
            warnings: Accumulated warning strings from the pipeline.
            ai_letter: Optional grounded recommendation letter from ``gpt-4o``.
                Injected between the discovery summary and the ranked table.
                If ``None``, this section is omitted silently.

        Returns:
            A multi-section Markdown string.
        """
        name = family_needs.get("family_name", "Family")
        comp = family_needs.get("composition") or {}
        edu  = family_needs.get("education") or {}
        rel  = family_needs.get("religious_and_culture") or {}

        lines: list[str] = [
            "# CityStrata Tactical Match Report",
            "",
            "> *You are not alone in this move — we use your real needs (education, faith, "
            "community) together with data from Eilat to shortlist places that fit your daily life, "
            "while staying aligned with the macro cluster plan. Rankings prioritize **tactical score** "
            "(amenity proximity, education fit, cluster alignment) and use **distance to the strategic "
            "cluster center** as a tiebreaker when scores are equal.*",
            "",
            f"## Family overview — **{name}**",
            "",
            "| Field | Value |",
            "|------|-------|",
            f"| Profile UUID | `{family_id}` |",
            f"| Household size | **{comp.get('total_people', '—')}** people |",
            f"| Children (infant→youth) | {comp.get('infants', 0)} / {comp.get('preschool', 0)} / "
            f"{comp.get('elementary', 0)} / {comp.get('youth', 0)} |",
            f"| Education focus | {edu.get('essential_education') or '—'} "
            f"(importance **{edu.get('education_proximity_importance', '—')}/5**) |",
            f"| Religious affiliation | **{rel.get('religious_affiliation', '—')}** |",
            f"| Needs synagogue | **{rel.get('needs_synagogue', False)}** |",
            "",
            "## Macro plan (cluster)",
            "",
        ]

        if matching:
            reasoning = str(matching.get("reasoning", ""))
            lines += [
                f"- **Assigned cluster:** {matching.get('recommended_cluster')}",
                f"- **Cluster #:** {matching.get('recommended_cluster_number')}",
                f"- **Confidence:** {matching.get('confidence')}",
                f"- **Rationale (macro):** {reasoning[:400]}" + ("…" if len(reasoning) > 400 else ""),
                "",
            ]
        else:
            lines += ["_No matching_result joined (unexpected if cluster_center exists)._", ""]

        lines += [
            "## Tactical anchor (cluster center)",
            "",
            f"- **Approx. center:** `{center_lat:.6f}, {center_lng:.6f}`",
            f"- **Based on:** {cluster_center.get('method', 'statistical areas')}",
            f"- **Areas aggregated:** {cluster_center.get('areas_used', '—')}",
            "",
            f"## Discovery ({self.discovery_radius_km} km radius)",
            "",
            f"- **Candidate pool:** {len(candidates)} listings (vector-ranked top 5 per table: Airbnb + hotels).",
            "",
        ]

        if not scored:
            lines += [
                "## Scoring",
                "",
                "**No successful scores** — all `calculate_location_score` calls failed.",
                "",
            ]
            if warnings:
                lines.append("### Warnings")
                lines += [f"- {w}" for w in warnings]
            return "\n".join(lines)

        # AI-generated recommendation letter (grounded on DB facts; omitted if generation failed).
        if ai_letter:
            lines += [
                "## Recommendation letter",
                "",
                "> *Generated by gpt-4o strictly from the spatial and scoring data above. "
                "No information has been added beyond what was retrieved from the database.*",
                "",
                ai_letter,
                "",
            ]

        lines += [
            "## Ranked listings (score, then cluster proximity)",
            "",
            "Sorted by **score (highest first)**; when scores tie, **closer to the cluster center** ranks higher.",
            "",
            "| Rank | Score /10 | Table | Label | Distance from cluster center |",
            "|-----:|----------:|-------|-------|------------------------------|",
        ]
        for i, row in enumerate(scored, start=1):
            sp = row.get("score_payload") or {}
            score = sp.get("score_out_of_10", "—")
            dclus = ((sp.get("metrics") or {}).get("distance_km_from_cluster_center")
                     or row.get("distance_km_from_cluster_center"))
            dclus_s = f"{float(dclus):.2f} km" if dclus is not None else "—"
            lines.append(
                f"| {i} | **{score}** | `{row['listing_table']}` | "
                f"{(row.get('label') or '—')[:48]} | {dclus_s} |"
            )

        lines += ["", "## Top 3 recommendations (justified)", ""]
        for i, row in enumerate(scored[:3], start=1):
            lines += self._format_recommendation(i, row)

        lines += ["## Full tactical summaries (tool)", ""]
        for row in scored[:3]:
            summ = (row.get("score_payload") or {}).get("summary")
            if summ:
                lines.append(f"- **{row.get('listing_id')}:** {summ}")
        lines.append("")

        if warnings:
            lines += ["## Warnings", ""]
            lines += [f"- {w}" for w in warnings]
            lines.append("")

        lines += [
            "---",
            "",
            "*CityStrata Tactical Agent — preserving routine (education, religion, community) "
            "within your strategically assigned Eilat cluster.*",
        ]
        return "\n".join(lines)

    def _format_recommendation(self, rank: int, row: dict[str, Any]) -> list[str]:
        """Format one top-3 recommendation section.

        Args:
            rank: 1-based rank number.
            row: Scored candidate dict containing ``score_payload``.

        Returns:
            A list of Markdown lines for this recommendation.
        """
        sp = row.get("score_payload") or {}
        metrics = sp.get("metrics") or {}
        breakdown = sp.get("breakdown") or []
        listing = sp.get("listing") or {}

        syn_km = metrics.get("nearest_synagogue_km")
        mat_km = metrics.get("nearest_matnas_km")
        schools_n = metrics.get("schools_total_nearby")
        school_match = metrics.get("schools_tag_matches_nearby")
        radius_edu = metrics.get("schools_radius_km")

        narrative: list[str] = [f"This option scores **{sp.get('score_out_of_10')}/10**."]
        if school_match and int(school_match) > 0:
            narrative.append(
                f"It is well supported for education: **{school_match}** school(s) within "
                f"**{radius_edu} km** closely match your stated essential education needs "
                f"({schools_n} schools nearby in total)."
            )
        elif schools_n:
            narrative.append(
                f"There are **{schools_n}** school(s) within **{radius_edu} km**; "
                f"overlap with your exact education tags is **{school_match or 0}** — "
                "worth confirming phases/types with the placement officer."
            )
        else:
            narrative.append(
                f"**No schools** were found within the **{radius_edu} km** scoring radius — "
                "critical if you have school-age children."
            )
        if syn_km is not None:
            narrative.append(f"Nearest synagogue is about **{_fmt_distance_km(float(syn_km))}** away.")
        if mat_km is not None:
            narrative.append(f"Nearest community center (matnas) is about **{_fmt_distance_km(float(mat_km))}** away.")

        label = listing.get("label") or row.get("label") or "Listing"
        address = listing.get("address") or row.get("address")

        lines: list[str] = [
            f"### {rank}. {label}",
            "",
            f"- **Table:** `{row['listing_table']}` · **ID:** `{row['listing_id']}`",
        ]
        if address:
            lines.append(f"- **Address / area:** {address}")
        lines += [
            "",
            " ".join(narrative),
            "",
        ]
        if breakdown:
            lines.append("**Score breakdown (tool):**")
            lines += [f"- {b}" for b in breakdown[:6]]
            lines.append("")
        return lines


# ---------------------------------------------------------------------------
# Public pipeline entry point
# ---------------------------------------------------------------------------


async def run_tactical_pipeline(
    family_id: str,
    *,
    server_path: Optional[Path] = None,
    radius_km: float = 2.5,
    tool_timeout_s: float = 240.0,
    score_concurrency: int = 4,
    skip_preflight: bool = False,
    forward_server_stderr: bool = False,
) -> str:
    """Run the full tactical pipeline for a single family.

    This is the main async entry point used by ``main()`` and any callers that
    want to embed the agent in a larger async application.

    Args:
        family_id: ``evacuee_family_profiles.uuid`` string.
        server_path: Override path to ``mcp_server.py``.
        radius_km: Discovery radius in km.
        tool_timeout_s: Per-tool-call timeout in seconds.
        score_concurrency: Max parallel scoring calls.
        skip_preflight: Skip the OpenAI + Postgres smoke test.
        forward_server_stderr: Forward child process stderr (risks deadlock on Windows).

    Returns:
        A Markdown tactical report string.
    """
    load_dotenv(_project_root() / ".env")
    load_dotenv(_project_root() / "mcp" / ".env")
    if not skip_preflight:
        await _smoke_openai_and_db()

    async with TacticalRelocationAgent(
        mcp_server_script=server_path,
        discovery_radius_km=radius_km,
        tool_timeout_s=tool_timeout_s,
        score_concurrency=score_concurrency,
        forward_server_stderr=forward_server_stderr,
    ) as agent:
        return await agent.run_for_family(family_id)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Parse CLI arguments and run the tactical pipeline."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    parser = argparse.ArgumentParser(
        description="CityStrata Tactical Agent — MCP-driven housing shortlist + report",
    )
    parser.add_argument(
        "--family-id",
        default=os.getenv("TACTICAL_SAMPLE_FAMILY_ID", "").strip(),
        help="evacuee_family_profiles.uuid (or set TACTICAL_SAMPLE_FAMILY_ID env var)",
    )
    parser.add_argument(
        "--server", type=Path, default=None,
        help="Path to mcp_server.py (default: sibling mcp_server.py)",
    )
    parser.add_argument(
        "--radius-km", type=float, default=2.5,
        help="Discovery radius around cluster center in km (default: 2.5)",
    )
    parser.add_argument(
        "--tool-timeout", type=float, default=240.0,
        help="Max seconds per MCP tool call (default: 240)",
    )
    parser.add_argument(
        "--score-concurrency", type=int, default=4,
        help="Parallel calculate_location_score calls (default: 4)",
    )
    parser.add_argument(
        "--skip-preflight", action="store_true",
        help="Skip OpenAI + Postgres smoke test before MCP (not recommended)",
    )
    parser.add_argument(
        "--forward-server-stderr", action="store_true",
        help="Forward mcp_server.py stderr to this terminal (may deadlock on Windows)",
    )
    args = parser.parse_args()

    if not args.family_id:
        print("Error: provide --family-id <uuid> or set TACTICAL_SAMPLE_FAMILY_ID.", file=sys.stderr)
        sys.exit(2)

    try:
        report = asyncio.run(
            run_tactical_pipeline(
                args.family_id,
                server_path=args.server,
                radius_km=args.radius_km,
                tool_timeout_s=args.tool_timeout,
                score_concurrency=args.score_concurrency,
                skip_preflight=args.skip_preflight,
                forward_server_stderr=args.forward_server_stderr,
            )
        )
        print(report, flush=True)
    except TimeoutError as exc:
        print(f"\nTimed out: {exc}", file=sys.stderr, flush=True)
        sys.exit(124)
    except (RuntimeError, OSError) as exc:
        print(f"\nFailed: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()