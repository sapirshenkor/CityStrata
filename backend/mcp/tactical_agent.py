"""
CityStrata Tactical Relocation Agent — Backward-Compatible Entry Point

This module re-exports the public API from the refactored agent modules
(base_agent, family_agent, multi_family_agent) so that existing callers
continue to work without import changes.

The combined CLI is preserved: both ``--family-id`` and ``--community-ids``
are supported from this single script.

Usage
-----
    python tactical_agent.py --family-id <uuid>
    python tactical_agent.py --community-ids <uuid> <uuid> [<uuid> ...]
    TACTICAL_SAMPLE_FAMILY_ID=<uuid> python tactical_agent.py
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

# ─── Re-exports for backward compatibility ────────────────────────────────────
# These names were previously defined here and are imported by external modules
# (e.g. backend/app/services/tactical_pipeline.py).

from family_agent import run_pipeline  # noqa: F401
from multi_family_agent import (  # noqa: F401
    MultiFamilyTacticalResult,
    run_multi_family_pipeline,
)

# Backward-compatible aliases for the old "Community" naming convention.
CommunityTacticalResult = MultiFamilyTacticalResult  # noqa: F401
run_community_pipeline = run_multi_family_pipeline  # noqa: F401


# ─── Combined CLI ─────────────────────────────────────────────────────────────


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
        help="Single evacuee_family_profiles.uuid (or set TACTICAL_SAMPLE_FAMILY_ID)",
    )
    parser.add_argument(
        "--community-ids",
        nargs="+",
        metavar="UUID",
        default=None,
        help="Multi-family mode: two or more family UUIDs (same cluster). "
        "Mutually exclusive with --family-id.",
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

    if args.community_ids and args.family_id:
        print(
            "Error: use either --family-id or --community-ids, not both.",
            file=sys.stderr,
        )
        sys.exit(2)

    if args.community_ids:
        if len(args.community_ids) < 2:
            print(
                "Error: --community-ids requires at least two UUIDs.",
                file=sys.stderr,
            )
            sys.exit(2)
        try:
            result = asyncio.run(
                run_multi_family_pipeline(
                    args.community_ids,
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
        return

    if not args.family_id:
        print(
            "Error: supply --family-id <uuid>, set TACTICAL_SAMPLE_FAMILY_ID, "
            "or use --community-ids with two or more UUIDs.",
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
