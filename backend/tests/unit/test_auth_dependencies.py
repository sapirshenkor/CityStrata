"""Unit tests for auth dependency behavior (mocked Supabase + DB)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core import auth as auth_module
from app.core.auth import get_current_user, require_editor
from tests.helpers.factories import municipality_user, sample_user_id
from tests.helpers.mock_db import MockPool


@pytest.mark.asyncio
async def test_get_current_user_rejects_missing_authorization():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=None)
    assert exc.value.status_code == 401
    assert "Missing Authorization" in exc.value.detail


@pytest.mark.asyncio
async def test_get_current_user_rejects_malformed_bearer():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Token abc")
    assert exc.value.status_code == 401
    assert "Invalid Authorization" in exc.value.detail


@pytest.mark.asyncio
async def test_get_current_user_loads_active_municipality_user(monkeypatch: pytest.MonkeyPatch):
    uid = sample_user_id()
    mock_anon = MagicMock()
    mock_anon.auth.get_user.return_value = SimpleNamespace(
        user=SimpleNamespace(id=str(uid))
    )
    monkeypatch.setattr(auth_module, "get_supabase_anon", lambda: mock_anon)

    pool = MockPool()
    row = {
        "id": uid,
        "email": "editor@example.com",
        "first_name": "Test",
        "last_name": "Editor",
        "phone_number": "050",
        "semel_yish": 2600,
        "department": "QA",
        "role": "editor",
        "is_active": True,
        "last_login_at": None,
        "created_at": municipality_user().created_at,
        "updated_at": municipality_user().updated_at,
    }
    pool.connection.on_fetchrow(lambda q, a: row if "municipality_users" in q else None)
    monkeypatch.setattr(auth_module, "get_pool", lambda: pool)

    user = await get_current_user(authorization="Bearer valid-token")

    assert user.id == uid
    assert user.role == "editor"
    mock_anon.auth.get_user.assert_called_once()


@pytest.mark.asyncio
async def test_get_current_user_rejects_inactive_user(monkeypatch: pytest.MonkeyPatch):
    uid = sample_user_id()
    mock_anon = MagicMock()
    mock_anon.auth.get_user.return_value = SimpleNamespace(
        user=SimpleNamespace(id=str(uid))
    )
    monkeypatch.setattr(auth_module, "get_supabase_anon", lambda: mock_anon)

    pool = MockPool()
    pool.connection.on_fetchrow(
        lambda q, a: {
            "id": uid,
            "email": "x@example.com",
            "first_name": "A",
            "last_name": "B",
            "phone_number": None,
            "semel_yish": 2600,
            "department": None,
            "role": "visitor",
            "is_active": False,
            "last_login_at": None,
            "created_at": municipality_user().created_at,
            "updated_at": municipality_user().updated_at,
        }
        if "municipality_users" in q
        else None
    )
    monkeypatch.setattr(auth_module, "get_pool", lambda: pool)

    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer valid-token")
    assert exc.value.status_code == 403
    assert "inactive" in exc.value.detail.lower()


def test_require_editor_allows_admin_and_editor():
    admin = municipality_user(role="admin")
    editor = municipality_user(role="editor")
    assert require_editor(user=admin).role == "admin"
    assert require_editor(user=editor).role == "editor"


def test_require_editor_rejects_visitor():
    visitor = municipality_user(role="visitor")
    with pytest.raises(HTTPException) as exc:
        require_editor(user=visitor)
    assert exc.value.status_code == 403
