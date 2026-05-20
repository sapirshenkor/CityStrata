"""API tests for matching endpoints (mocked OpenAI agent + DB)."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

import app.api.endpoints.matching as matching_endpoints
from tests.helpers.factories import evacuee_family_profile_base, evacuee_profile_db_row
from tests.helpers.matching_data import (
    cluster_profile_db_rows,
    matching_result_db_row,
    sample_agent1_response,
    sample_run_id,
)


def _wire_clustering_db(mock_pool, *, run_id=None, profiles=None, run_missing=False):
    run_id = run_id or sample_run_id()
    profiles = profiles if profiles is not None else cluster_profile_db_rows()

    def fetchval_handler(query: str, args: tuple):
        if "clustering_runs" in query and "ORDER BY" in query:
            return None if run_missing else run_id
        if "INSERT INTO public.matching_results" in query or "community_matching_results" in query:
            return uuid4()
        return None

    def fetchrow_handler(query: str, args: tuple):
        if "evacuee_family_profiles" in query and "WHERE uuid" in query:
            return evacuee_profile_db_row(profile_uuid=args[0])
        if "community_profiles" in query and "WHERE id" in query:
            return None
        if "matching_results" in query or "community_matching_results" in query:
            return matching_result_db_row(profile_uuid=args[0] if args else uuid4())
        return None

    def fetch_handler(query: str, args: tuple):
        if "cluster_profiles" in query:
            return profiles
        return None

    mock_pool.connection.on_fetchval(fetchval_handler)
    mock_pool.connection.on_fetchrow(fetchrow_handler)
    mock_pool.connection.on_fetch(fetch_handler)
    mock_pool.connection.on_execute(lambda q, a: "OK")


@pytest.mark.asyncio
async def test_post_cluster_returns_mocked_agent_response(client, mock_pool, monkeypatch):
    _wire_clustering_db(mock_pool)
    agent_response = sample_agent1_response()
    monkeypatch.setattr(
        matching_endpoints,
        "match_family_to_cluster",
        AsyncMock(return_value=agent_response),
    )

    response = await client.post(
        "/api/matching/cluster",
        json=evacuee_family_profile_base().model_dump(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["recommended_cluster"] == "Residential - Secular"
    assert body["confidence"] == "high"
    assert body["flags"] == ["נדרשת נגישות"]
    matching_endpoints.match_family_to_cluster.assert_awaited_once()


@pytest.mark.asyncio
async def test_post_cluster_returns_404_when_no_clustering_run(client, mock_pool):
    _wire_clustering_db(mock_pool, run_missing=True)

    response = await client.post(
        "/api/matching/cluster",
        json=evacuee_family_profile_base().model_dump(),
    )
    assert response.status_code == 404
    assert "No clustering run" in response.json()["detail"]


@pytest.mark.asyncio
async def test_post_cluster_returns_500_when_agent_fails(client, mock_pool, monkeypatch):
    _wire_clustering_db(mock_pool)
    monkeypatch.setattr(
        matching_endpoints,
        "match_family_to_cluster",
        AsyncMock(side_effect=RuntimeError("OpenAI API call failed")),
    )

    response = await client.post(
        "/api/matching/cluster",
        json=evacuee_family_profile_base().model_dump(),
    )
    assert response.status_code == 500
    assert "OpenAI" in response.json()["detail"]


@pytest.mark.asyncio
async def test_post_cluster_rejects_invalid_body(client):
    response = await client.post(
        "/api/matching/cluster",
        json={"family_name": "only-name"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_cluster_for_profile_persists_and_returns_agent_output(
    client, mock_pool, monkeypatch
):
    profile_id = uuid4()
    _wire_clustering_db(mock_pool)
    monkeypatch.setattr(
        matching_endpoints,
        "match_family_to_cluster",
        AsyncMock(return_value=sample_agent1_response()),
    )

    response = await client.post(f"/api/matching/cluster/{profile_id}")
    assert response.status_code == 200
    assert response.json()["recommended_cluster"] == "Residential - Secular"


@pytest.mark.asyncio
async def test_post_cluster_for_profile_returns_404_when_profile_missing(client, mock_pool):
    mock_pool.connection.on_fetchrow(
        lambda q, a: None if "evacuee_family_profiles" in q else None
    )

    response = await client.post(f"/api/matching/cluster/{uuid4()}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_matching_result_returns_404_when_unlinked(client, mock_pool):
    mock_pool.connection.on_fetchrow(lambda q, a: None)

    response = await client.get(f"/api/matching/result/{uuid4()}")
    assert response.status_code == 404
    assert "No matching result" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_matching_result_returns_linked_row(client, mock_pool):
    profile_id = uuid4()
    row = matching_result_db_row(profile_uuid=profile_id)
    mock_pool.connection.on_fetchrow(lambda q, a: row)

    response = await client.get(f"/api/matching/result/{profile_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["recommended_cluster"] == row["recommended_cluster"]
    assert body["profile_uuid"] == str(profile_id)
