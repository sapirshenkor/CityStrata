"""Focused API tests for failure paths and error responses."""

from __future__ import annotations

from uuid import uuid4

import pytest

import app.api.endpoints.recommendations as recommendations_endpoints

@pytest.mark.asyncio
async def test_statistical_areas_returns_500_on_database_error(client, mock_pool):
    async def boom(_query: str, _args: tuple):
        raise RuntimeError("connection reset")

    mock_pool.connection.on_fetch(boom)

    response = await client.get("/api/statistical-areas")
    assert response.status_code == 500
    assert "Database error" in response.json()["detail"]


@pytest.mark.asyncio
async def test_recommendations_overview_returns_500_on_database_error(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="editor")

    async def boom(_query: str, _args: tuple):
        raise RuntimeError("query failed")

    mock_pool.connection.on_fetch(boom)

    response = await authed_client.get("/api/recommendations/overview")
    assert response.status_code == 500
    assert "Database error" in response.json()["detail"]


@pytest.mark.asyncio
async def test_matching_result_lookup_returns_500_on_database_error(client, mock_pool):
    async def boom(_query: str, _args: tuple):
        raise RuntimeError("disk full")

    mock_pool.connection.on_fetchrow(boom)

    response = await client.get(f"/api/matching/result/{uuid4()}")
    assert response.status_code == 500
    assert "Database error" in response.json()["detail"]


@pytest.mark.asyncio
async def test_run_recommendation_returns_500_when_row_missing_after_pipeline(
    client, mock_pool, monkeypatch
):
    from unittest.mock import AsyncMock

    profile_uuid = uuid4()
    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "uuid": profile_uuid,
            "selected_matching_result_id": uuid4(),
        }
        if "evacuee_family_profiles" in q and "selected_matching" in q
        else None
    )
    monkeypatch.setattr(
        recommendations_endpoints,
        "execute_tactical_pipeline",
        AsyncMock(return_value="done"),
    )

    response = await client.post(f"/api/recommendations/run/{profile_uuid}")
    assert response.status_code == 500
    assert "no family_tactical_responses row" in response.json()["detail"].lower()
