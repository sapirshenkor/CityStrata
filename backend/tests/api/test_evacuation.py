"""API tests for evacuation analysis business logic."""

import pytest

from tests.helpers.factories import stat_area_row


@pytest.mark.asyncio
async def test_evacuation_analyze_rejects_empty_areas(client):
    response = await client.post(
        "/api/evacuation/analyze",
        json={"evacuate_areas": [], "scenario": "emergency"},
    )
    assert response.status_code == 400
    assert "At least one area" in response.json()["detail"]


@pytest.mark.asyncio
async def test_evacuation_analyze_computes_deficit_and_recommendations(
    client, mock_pool
):
    def capacity_handler(query: str, args: tuple):
        if "airbnb_listings" in query:
            return [{"stat_2022": 100, "listing_count": 2, "airbnb_capacity": 10}]
        return None

    def need_handler(query: str, args: tuple):
        if "educational_institutions" in query:
            return [
                {
                    "stat_2022": 100,
                    "institutions_count": 2,
                    "estimated_children": 60,
                    "estimated_staff": 10,
                    "total_estimated_population": 70,
                }
            ]
        return None

    mock_pool.connection.on_fetch(capacity_handler)
    mock_pool.connection.on_fetch(need_handler)

    response = await client.post(
        "/api/evacuation/analyze",
        json={"evacuate_areas": [100], "scenario": "emergency"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_capacity"] == 10
    assert body["total_need"] == 70
    assert body["capacity_deficit"] == -60
    assert any("deficit" in r.lower() for r in body["recommendations"])


@pytest.mark.asyncio
async def test_evacuation_analyze_surplus_when_capacity_exceeds_need(client, mock_pool):
    def capacity_handler(query: str, args: tuple):
        if "airbnb_listings" in query:
            return [{"stat_2022": 200, "listing_count": 5, "airbnb_capacity": 100}]
        return None

    def need_handler(query: str, args: tuple):
        if "educational_institutions" in query:
            return [
                {
                    "stat_2022": 200,
                    "institutions_count": 1,
                    "estimated_children": 30,
                    "estimated_staff": 5,
                    "total_estimated_population": 35,
                }
            ]
        return None

    mock_pool.connection.on_fetch(capacity_handler)
    mock_pool.connection.on_fetch(need_handler)

    response = await client.post(
        "/api/evacuation/analyze",
        json={"evacuate_areas": [200], "scenario": "planned"},
    )
    body = response.json()
    assert body["capacity_deficit"] == 65
    assert any("surplus" in r.lower() for r in body["recommendations"])
