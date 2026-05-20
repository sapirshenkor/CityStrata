"""API tests for property listing auth and ownership behavior."""

from __future__ import annotations

from uuid import uuid4

import pytest

from tests.helpers.factories import (
    other_user_id,
    property_listing_db_row,
    sample_user_id,
)


def _listing_create_payload(**overrides) -> dict:
    data = {
        "property_type": "apartment",
        "city": "Eilat",
        "street": "Herzl",
        "house_number": "1",
        "latitude": 29.55,
        "longitude": 34.95,
        "publisher_name": "Publisher",
        "phone_number": "0500000000",
        "units": [{"rooms": 3.5, "bathrooms": 1}],
    }
    data.update(overrides)
    return data


@pytest.mark.asyncio
async def test_list_mine_requires_authentication(client, app):
    app.dependency_overrides.clear()
    response = await client.get("/api/property-listings/mine")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_mine_returns_only_current_user_listings(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    listing = property_listing_db_row(owner_id=sample_user_id())
    captured_owner: list = []

    def fetch_handler(query: str, args: tuple):
        if "municipality_user_id = $1" in query:
            captured_owner.append(args[0])
            return [listing]
        if "property_listing_units" in query:
            return []
        return None

    mock_pool.connection.on_fetch(fetch_handler)

    response = await authed_client.get("/api/property-listings/mine")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert captured_owner == [sample_user_id()]


@pytest.mark.asyncio
async def test_get_listing_by_id_allows_any_authenticated_user(
    authed_client, mock_pool, auth_overrides
):
    """
    Documents current behavior: GET /{listing_id} does not enforce ownership
    (municipality_user_id check is not applied on read).
    """
    auth_overrides(role="visitor")
    listing_id = uuid4()
    listing = property_listing_db_row(
        listing_id=listing_id,
        owner_id=other_user_id(),
    )

    def fetchrow_handler(query: str, args: tuple):
        if "FROM public.property_listings pl" in query and "WHERE pl.id" in query:
            return listing
        return None

    def fetch_handler(query: str, args: tuple):
        if "property_listing_units" in query:
            return []
        return None

    mock_pool.connection.on_fetchrow(fetchrow_handler)
    mock_pool.connection.on_fetch(fetch_handler)

    response = await authed_client.get(f"/api/property-listings/{listing_id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(listing_id)


@pytest.mark.asyncio
async def test_patch_listing_returns_403_for_non_owner(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    listing_id = uuid4()

    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "id": listing_id,
            "municipality_user_id": other_user_id(),
            "city": "Eilat",
            "street": "Herzl",
            "house_number": "1",
            "latitude": 29.55,
            "longitude": 34.95,
        }
        if "FROM public.property_listings" in q and "WHERE id" in q
        else None
    )

    response = await authed_client.patch(
        f"/api/property-listings/{listing_id}",
        json={"publisher_name": "Hacker"},
    )
    assert response.status_code == 403
    assert "only update listings that you created" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_listing_returns_403_for_non_owner(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    listing_id = uuid4()

    mock_pool.connection.on_fetchrow(
        lambda q, a: {
            "municipality_user_id": other_user_id(),
        }
        if "SELECT municipality_user_id" in q
        else None
    )

    response = await authed_client.delete(f"/api/property-listings/{listing_id}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_listings_rejects_partial_geo_filter(client):
    response = await client.get(
        "/api/property-listings",
        params={"latitude": 29.55, "longitude": 34.95},
    )
    assert response.status_code == 400
    assert "must be provided together" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_listing_rejects_other_property_type_without_description(
    authed_client,
):
    response = await authed_client.post(
        "/api/property-listings",
        json=_listing_create_payload(property_type="other"),
    )
    assert response.status_code == 422
