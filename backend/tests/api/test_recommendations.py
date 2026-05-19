"""API tests for recommendation endpoints (mocked tactical pipeline)."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

import app.api.endpoints.recommendations as recommendations_endpoints
from tests.helpers.factories import (
    sample_user_id,
    tactical_response_db_row,
)

@pytest.mark.asyncio
async def test_run_tactical_recommendation_success(client, mock_pool, monkeypatch):
    profile_uuid = uuid4()
    matching_id = uuid4()
    tactical_row = tactical_response_db_row(profile_uuid=profile_uuid)

    def fetchrow_handler(query: str, args: tuple):
        if "selected_matching_result_id" in query:
            return {
                "uuid": profile_uuid,
                "selected_matching_result_id": matching_id,
            }
        if "family_tactical_responses" in query:
            return tactical_row
        return None

    mock_pool.connection.on_fetchrow(fetchrow_handler)
    monkeypatch.setattr(
        recommendations_endpoints,
        "execute_tactical_pipeline",
        AsyncMock(return_value="# Report"),
    )

    response = await client.post(f"/api/recommendations/run/{profile_uuid}")
    assert response.status_code == 200
    body = response.json()
    assert body["profile_uuid"] == str(profile_uuid)
    assert "Tactical report" in body["agent_output"]
    assert body["radii_data"][0]["hub_label"] == "education"
    recommendations_endpoints.execute_tactical_pipeline.assert_awaited_once_with(
        profile_uuid
    )


@pytest.mark.asyncio
async def test_run_tactical_recommendation_requires_matching_first(client, mock_pool):
    profile_uuid = uuid4()
    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "uuid": profile_uuid,
            "selected_matching_result_id": None,
        }
    )

    response = await client.post(f"/api/recommendations/run/{profile_uuid}")
    assert response.status_code == 400
    assert "Matching has not been run" in response.json()["detail"]


@pytest.mark.asyncio
async def test_run_tactical_recommendation_returns_404_for_unknown_profile(
    client, mock_pool
):
    mock_pool.connection.on_fetchrow(lambda q, a: None)

    response = await client.post(f"/api/recommendations/run/{uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_run_tactical_recommendation_pipeline_timeout(client, mock_pool, monkeypatch):
    profile_uuid = uuid4()
    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "uuid": profile_uuid,
            "selected_matching_result_id": uuid4(),
        }
    )
    monkeypatch.setattr(
        recommendations_endpoints,
        "execute_tactical_pipeline",
        AsyncMock(side_effect=TimeoutError("pipeline hung")),
    )

    response = await client.post(f"/api/recommendations/run/{profile_uuid}")
    assert response.status_code == 504
    assert "timed out" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_run_tactical_recommendation_pipeline_runtime_error(
    client, mock_pool, monkeypatch
):
    profile_uuid = uuid4()
    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "uuid": profile_uuid,
            "selected_matching_result_id": uuid4(),
        }
    )
    monkeypatch.setattr(
        recommendations_endpoints,
        "execute_tactical_pipeline",
        AsyncMock(side_effect=RuntimeError("MCP tool failure")),
    )

    response = await client.post(f"/api/recommendations/run/{profile_uuid}")
    assert response.status_code == 500
    assert "MCP tool failure" in response.json()["detail"]


@pytest.mark.asyncio
async def test_community_run_rejects_single_family_uuid(client):
    response = await client.post(
        "/api/recommendations/community/run",
        json={"family_uuids": [str(uuid4())]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_community_run_returns_400_on_validation_error(client, monkeypatch):
    monkeypatch.setattr(
        recommendations_endpoints,
        "execute_community_tactical_pipeline",
        AsyncMock(side_effect=ValueError("Profiles must share the same macro cluster")),
    )

    response = await client.post(
        "/api/recommendations/community/run",
        json={"family_uuids": [str(uuid4()), str(uuid4())]},
    )
    assert response.status_code == 400
    assert "macro cluster" in response.json()["detail"]


@pytest.mark.asyncio
async def test_overview_scopes_visitor_to_own_user_id(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    captured_user_ids: list = []

    def fetch_handler(query: str, args: tuple):
        if "overview" in query or "user_id = $1" in query:
            captured_user_ids.append(args[0])
            return [
                {
                    "profile_uuid": uuid4(),
                    "family_name": "Mine",
                    "has_matching": False,
                    "has_tactical": False,
                    "tactical_created_at": None,
                    "cluster_number": None,
                    "is_merged_profile": False,
                }
            ]
        return None

    mock_pool.connection.on_fetch(fetch_handler)

    response = await authed_client.get("/api/recommendations/overview")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert captured_user_ids == [sample_user_id()]


@pytest.mark.asyncio
async def test_get_recommendation_returns_404_when_missing(client, mock_pool):
    mock_pool.connection.on_fetchrow(lambda q, a: None)

    response = await client.get(f"/api/recommendations/{uuid4()}")
    assert response.status_code == 404
