"""API tests for auth routes with mocked Supabase and database."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest

import app.api.endpoints.auth as auth_endpoints
from tests.helpers.factories import sample_user_id


@pytest.mark.asyncio
async def test_login_returns_token_and_user(client, mock_pool, monkeypatch):
    uid = sample_user_id()
    now = datetime(2025, 6, 1, tzinfo=timezone.utc)

    mock_anon = MagicMock()
    mock_anon.auth.sign_in_with_password.return_value = SimpleNamespace(
        session=SimpleNamespace(
            access_token="test-access-token",
            user=SimpleNamespace(id=str(uid)),
        )
    )
    monkeypatch.setattr(auth_endpoints, "get_supabase_anon", lambda: mock_anon)

    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "id": uid,
            "email": "user@example.com",
            "first_name": "Muni",
            "last_name": "User",
            "phone_number": "050",
            "semel_yish": 2600,
            "department": "Ops",
            "role": "editor",
            "is_active": True,
            "created_at": now,
        }
        if "municipality_users" in q and "SELECT" in q
        else None
    )
    mock_pool.connection.on_execute(lambda q, a: "OK" if "UPDATE municipality_users" in q else None)

    response = await client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "test-access-token"
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["role"] == "editor"


@pytest.mark.asyncio
async def test_login_rejects_invalid_credentials(client, monkeypatch):
    from supabase_auth.errors import AuthApiError

    mock_anon = MagicMock()
    mock_anon.auth.sign_in_with_password.side_effect = AuthApiError(
        "Invalid email or password",
        status=400,
        code="invalid_credentials",
    )
    monkeypatch.setattr(auth_endpoints, "get_supabase_anon", lambda: mock_anon)

    response = await client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrong"},
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_me_returns_current_user(authed_client, app, auth_overrides):
    auth_overrides(role="editor")
    response = await authed_client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer ignored-when-overridden"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "editor"


@pytest.mark.asyncio
async def test_logout_returns_client_message(client):
    response = await client.post("/api/auth/logout")
    assert response.status_code == 200
    assert "discard" in response.json()["message"].lower()
