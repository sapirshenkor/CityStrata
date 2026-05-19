"""API tests for statistical areas GeoJSON responses."""

import pytest

from tests.helpers.factories import stat_area_row


@pytest.mark.asyncio
async def test_list_statistical_areas_returns_feature_collection(client, mock_pool):
    mock_pool.connection.on_fetch(
        lambda q, a: [stat_area_row(stat_2022=100), stat_area_row(stat_2022=101)]
        if "statistical_areas" in q
        else None
    )

    response = await client.get("/api/statistical-areas")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 2
    props = body["features"][0]["properties"]
    assert props["stat_2022"] in (100, 101)
    assert body["features"][0]["geometry"]["type"] == "Polygon"


@pytest.mark.asyncio
async def test_get_statistical_area_summary_returns_404_when_missing(client, mock_pool):
    mock_pool.connection.on_fetchrow(lambda q, a: None)

    response = await client.get("/api/statistical-areas/999/summary")
    assert response.status_code == 404
