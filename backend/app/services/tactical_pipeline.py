"""Run the tactical MCP pipeline from the API (single-family and multi-family).

The heavy lifting lives in the ``mcp/`` agent modules.  This thin service
layer adds API-level validation (e.g. same-cluster check) and delegates to
the agent pipelines which handle profile creation and response persistence.
"""

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
    run_community_pipeline,
    run_pipeline,
)


async def execute_tactical_pipeline(profile_uuid: UUID) -> str:
    """
    Run the full tactical pipeline for one family.
    Returns the Markdown report string (also persisted to family_tactical_responses).
    """
    return await run_pipeline(str(profile_uuid))


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
    Validate source profiles, run multi-family tactical MCP pipeline.

    The agent (``multi_family_agent``) handles profile creation in
    ``multi_family_profiles`` and response persistence in
    ``multi_family_tactical_responses``.

    Returns the multi-family profile UUID.
    """
    if len(profile_uuids) < 2:
        raise ValueError("Select at least two family profiles.")

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT uuid, selected_matching_result_id
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

    uid_strings = [str(u) for u in profile_uuids]
    tactical_result = await run_community_pipeline(uid_strings)
    if not tactical_result.ok:
        raise ValueError(tactical_result.report)

    if tactical_result.multi_family_uuid:
        return UUID(tactical_result.multi_family_uuid)

    raise RuntimeError(
        "Multi-family pipeline completed but did not produce a profile UUID."
    )
