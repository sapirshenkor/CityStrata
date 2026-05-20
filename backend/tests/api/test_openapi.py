"""API smoke tests for application metadata (no database queries)."""

import pytest


@pytest.mark.asyncio
async def test_openapi_schema_lists_core_route_prefixes(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/statistical-areas" in paths
    assert "/api/auth/login" in paths
    assert "/api/evacuation/analyze" in paths


@pytest.mark.asyncio
async def test_app_title_and_version(client):
    response = await client.get("/openapi.json")
    info = response.json()["info"]
    assert info["title"] == "CityStrata API"
    assert info["version"] == "0.1.0"
