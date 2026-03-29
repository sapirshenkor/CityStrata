"""
Generic MCP Agent Base — Domain-Agnostic Infrastructure

Provides the async context-manager lifecycle for an MCP ``stdio_client``
connection, a tool-invocation wrapper with timeout handling, and a small
set of reusable helpers (progress output, response decoding, path
resolution).

This module contains **zero** domain knowledge.  All evacuee / family /
education / religion logic lives in ``tactical_utils.py`` and the concrete
agent subclasses.

Usage::

    class MyAgent(BaseTacticalAgent):
        async def run(self, some_id: str) -> str:
            data = await self._call("my_tool", id=some_id)
            return data["report"]

    async with MyAgent() as agent:
        result = await agent.run("abc-123")
"""

from __future__ import annotations

import abc
import asyncio
import json
import logging
import os
import sys
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)


# ─── Path helpers ─────────────────────────────────────────────────────────────


def _project_root() -> Path:
    """Repository root (parent of the backend/ folder)."""
    return Path(__file__).resolve().parent.parent.parent


def _default_server_path() -> Path:
    """mcp_server.py sits next to this file."""
    return Path(__file__).resolve().parent / "mcp_server.py"


# ─── Progress output ──────────────────────────────────────────────────────────


def _progress(msg: str) -> None:
    """Write a progress line to stderr (stdout is reserved for the final report)."""
    print(msg, file=sys.stderr, flush=True)


# ─── MCP response decoder ─────────────────────────────────────────────────────


def _decode(result: Any) -> dict[str, Any]:
    """
    Decode an MCP call_tool result into a plain dict.

    FastMCP may return structuredContent (a dict) or a list of text blocks
    containing JSON — both forms are handled here.
    """
    if getattr(result, "isError", False):
        raise RuntimeError(
            f"MCP tool error: {getattr(result, 'error', 'unknown error')}"
        )

    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict):
        return structured

    chunks: list[str] = []
    for block in getattr(result, "content", []) or []:
        btype = getattr(block, "type", None) or (
            block.get("type") if isinstance(block, dict) else None
        )
        text = getattr(block, "text", None) or (
            block.get("text") if isinstance(block, dict) else None
        )
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


# ─── Base Agent ───────────────────────────────────────────────────────────────


class BaseTacticalAgent(abc.ABC):
    """
    Async context-manager base for MCP-based agents.

    Handles initialisation (paths, MCP server subprocess),
    ``AsyncExitStack`` and ``stdio_client`` connection lifecycle, and
    the common ``_call`` tool-invocation wrapper with timeout.

    Subclasses implement the abstract ``run()`` method with their
    specific pipeline logic.

    Usage::

        async with SomeAgent() as agent:
            result = await agent.run(...)
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
        self._errlog = (
            sys.stderr
            if forward_server_stderr
            else open(os.devnull, "w", encoding="utf-8")
        )
        self._stack: Optional[AsyncExitStack] = None
        self._session: Optional[ClientSession] = None

    # ── Context manager ───────────────────────────────────────────────────

    async def __aenter__(self) -> BaseTacticalAgent:
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
        _progress(f"[agent] Connected to MCP server: {self._server_path.name}")
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._stack:
            await self._stack.aclose()
        self._session = None
        self._stack = None

    # ── Tool call wrapper ─────────────────────────────────────────────────

    async def _call(self, tool: str, **kwargs: Any) -> dict[str, Any]:
        """Call a named MCP tool with keyword arguments and decode the response."""
        assert (
            self._session is not None
        ), "Agent not connected. Use 'async with agent:'."
        _progress(f"[agent] → {tool} …")
        try:
            raw = await asyncio.wait_for(
                self._session.call_tool(tool, kwargs),
                timeout=self.tool_timeout_s,
            )
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"MCP tool {tool!r} timed out after {self.tool_timeout_s}s. "
                "Check DATABASE_URL, network, and API availability."
            ) from exc
        return _decode(raw)

    # ── Abstract pipeline ─────────────────────────────────────────────────

    @abc.abstractmethod
    async def run(self, *args: Any, **kwargs: Any) -> Any:
        """Override in subclasses to implement the specific pipeline."""
        ...
