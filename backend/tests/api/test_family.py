"""API tests for /family/me user-scoped profile routes."""

from __future__ import annotations

from uuid import uuid4

import pytest

from tests.helpers.factories import evacuee_profile_db_row, sample_user_id


@pytest.mark.asyncio
async def test_family_profiles_requires_authentication(client, app):
    app.dependency_overrides.clear()
    response = await client.get("/api/family/me/profiles")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_profiles_returns_only_current_user_rows(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    own = evacuee_profile_db_row(user_id=sample_user_id(), family_name="Mine")

    def fetch_handler(query: str, args: tuple):
        if "WHERE user_id" in query:
            return [own] if args[0] == sample_user_id() else []
        return None

    mock_pool.connection.on_fetch(fetch_handler)

    response = await authed_client.get("/api/family/me/profiles")
    assert response.status_code == 200
    names = [p["family_name"] for p in response.json()]
    assert names == ["Mine"]


@pytest.mark.asyncio
async def test_get_profile_returns_404_for_other_users_profile(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    foreign_uuid = uuid4()

    def fetchrow_handler(query: str, args: tuple):
        if "uuid = $1 AND user_id = $2" in query:
            return None
        return None

    mock_pool.connection.on_fetchrow(fetchrow_handler)

    response = await authed_client.get(f"/api/family/me/profiles/{foreign_uuid}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_profile_returns_owned_profile(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    profile_uuid = uuid4()
    row = evacuee_profile_db_row(
        user_id=sample_user_id(),
        profile_uuid=profile_uuid,
        family_name="Owned",
    )

    def fetchrow_handler(query: str, args: tuple):
        if "uuid = $1 AND user_id = $2" in query:
            if args[0] == profile_uuid and args[1] == sample_user_id():
                return row
        return None

    mock_pool.connection.on_fetchrow(fetchrow_handler)

    response = await authed_client.get(f"/api/family/me/profiles/{profile_uuid}")
    assert response.status_code == 200
    assert response.json()["family_name"] == "Owned"


@pytest.mark.asyncio
async def test_dashboard_summary_reflects_user_scoped_counts(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    profiles = [
        evacuee_profile_db_row(
            user_id=sample_user_id(),
            selected_matching_result_id=uuid4(),
        ),
        evacuee_profile_db_row(user_id=sample_user_id()),
    ]

    def fetch_handler(query: str, args: tuple):
        if "WHERE user_id" in query and "ORDER BY" in query:
            return profiles if args[0] == sample_user_id() else []
        return None

    def fetchrow_handler(query: str, args: tuple):
        if "COUNT(*)" in query and "profiles_with_matching_count" in query:
            return {"profile_count": 2, "profiles_with_matching_count": 1}
        return None

    mock_pool.connection.on_fetch(fetch_handler)
    mock_pool.connection.on_fetchrow(fetchrow_handler)

    response = await authed_client.get("/api/family/me/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["profile_count"] == 2
    assert body["summary"]["profiles_with_matching_count"] == 1
    assert len(body["profiles"]) == 2
    assert body["user"]["id"] == str(sample_user_id())


@pytest.mark.asyncio
async def test_create_profile_assigns_current_user(
    authed_client, mock_pool, auth_overrides
):
    auth_overrides(role="visitor")
    created = evacuee_profile_db_row(user_id=sample_user_id(), family_name="New family")
    captured_insert_user: list = []

    def fetchrow_handler(query: str, args: tuple):
        if "INSERT INTO evacuee_family_profiles" in query:
            captured_insert_user.append(args[0])
            return created
        return None

    mock_pool.connection.on_fetchrow(fetchrow_handler)

    payload = {
        "family_name": "New family",
        "contact_name": "Contact",
        "contact_phone": "0501111111",
        "contact_email": "new@example.com",
        "city_name": "Eilat",
        "home_address": "2 Herzl",
        "total_people": 3,
        "religious_affiliation": "secular",
    }
    response = await authed_client.post("/api/family/me/profiles", json=payload)
    assert response.status_code == 201
    assert captured_insert_user == [sample_user_id()]
