"""API tests for nearby resource validation."""

import pytest


@pytest.mark.asyncio
async def test_nearby_rejects_invalid_resource_type(client):
    response = await client.get(
        "/api/nearby",
        params={"lat": 29.55, "lon": 34.95, "type": "hospital"},
    )
    assert response.status_code == 400
    assert "Invalid resource type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_nearby_requires_type_parameter(client):
    response = await client.get("/api/nearby", params={"lat": 29.55, "lon": 34.95})
    assert response.status_code == 422
