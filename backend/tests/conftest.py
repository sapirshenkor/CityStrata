"""
Shared pytest configuration.

Environment variables are set before any ``app`` import so pydantic Settings
can initialize without a real .env file.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Callable
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

# ── Safe defaults (no real services) ─────────────────────────────────────────
os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/citystrata_test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")

from app.core import database as database_module  # noqa: E402
from app.core.auth import get_current_user, require_editor  # noqa: E402
from app.main import create_app  # noqa: E402
from tests.helpers.factories import municipality_user  # noqa: E402
from tests.helpers.mock_db import MockPool  # noqa: E402


@pytest.fixture
def mock_pool() -> MockPool:
    return MockPool()


@pytest.fixture
async def install_mock_db(mock_pool: MockPool, monkeypatch: pytest.MonkeyPatch) -> MockPool:
    """Wire a mock asyncpg pool into the app without opening a real database."""

    async def _init() -> MockPool:
        database_module._pool = mock_pool  # type: ignore[attr-defined]
        return mock_pool

    async def _close() -> None:
        database_module._pool = None  # type: ignore[attr-defined]

    monkeypatch.setattr(database_module, "init_db_pool", _init)
    monkeypatch.setattr(database_module, "close_db_pool", _close)
    # Endpoints import get_pool before tests run; they still read module-level _pool.
    database_module._pool = mock_pool  # type: ignore[attr-defined]
    yield mock_pool
    database_module._pool = None  # type: ignore[attr-defined]


@pytest.fixture
async def app(install_mock_db: MockPool):
    return create_app()


@pytest.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_overrides(app) -> Callable[..., None]:
    """Register FastAPI dependency overrides for authenticated routes."""

    def _apply(
        *,
        role: str = "editor",
        is_active: bool = True,
    ) -> None:
        user = municipality_user(role=role, is_active=is_active)

        async def _current_user() -> Any:
            return user

        app.dependency_overrides[get_current_user] = _current_user
        # Leave require_editor real so role checks (403) are exercised in API tests.

    yield _apply
    app.dependency_overrides.clear()


@pytest.fixture
def authed_client(client: AsyncClient, app, auth_overrides) -> AsyncClient:
    auth_overrides(role="editor")
    return client
