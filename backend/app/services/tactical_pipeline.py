"""Run the tactical MCP pipeline from the API"""

import sys
from pathlib import Path
from uuid import UUID

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_MCP_DIR = _BACKEND_DIR / "mcp"
if str(_MCP_DIR) not in sys.path:
    sys.path.insert(0, str(_MCP_DIR))

from tactical_agent import run_pipeline  # noqa: E402


async def execute_tactical_pipeline(profile_uuid: UUID) -> str:
    """
    Run the full tactical pipeline for one family.
    Returns the Markdown report string (also persisted by tactical_agent).
    """
    return await run_pipeline(str(profile_uuid))
