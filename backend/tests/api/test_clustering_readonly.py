"""API tests for read-only clustering endpoints (mocked DB)."""

from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_clustering_latest_returns_null_when_no_runs(client, mock_pool):
    mock_pool.connection.on_fetchrow(lambda q, a: None)

    response = await client.get("/api/clustering/latest")
    assert response.status_code == 200
    assert response.json()["run"] is None


@pytest.mark.asyncio
async def test_clustering_profiles_returns_404_for_unknown_run(client, mock_pool):
    run_id = uuid4()

    mock_pool.connection.on_fetch(
        lambda q, a: [] if "cluster_profiles" in q else None
    )
    mock_pool.connection.on_fetchval(
        lambda q, a: False if "clustering_runs" in q and "EXISTS" in q else None
    )

    response = await client.get(f"/api/clustering/profiles?run_id={run_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Run not found"
