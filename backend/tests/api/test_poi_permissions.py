"""API tests for POI route authentication and role checks."""

import pytest


@pytest.mark.asyncio
async def test_poi_list_requires_authentication(client, app):
    app.dependency_overrides.clear()
    response = await client.get("/api/poi/restaurants")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_poi_list_rejects_visitor_role(client, app, auth_overrides):
    auth_overrides(role="visitor")
    response = await client.get(
        "/api/poi/restaurants",
        headers={"Authorization": "Bearer test"},
    )
    assert response.status_code == 403
    assert "Editor or admin" in response.json()["detail"]


@pytest.mark.asyncio
async def test_poi_list_rejects_unknown_category(authed_client, mock_pool):
    mock_pool.connection.on_fetchval(lambda q, a: 0)
    mock_pool.connection.on_fetch(lambda q, a: [])

    response = await authed_client.get("/api/poi/not_a_real_category")
    assert response.status_code == 400
    assert "Unknown category" in response.json()["detail"]
