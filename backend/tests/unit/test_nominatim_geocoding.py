"""Unit tests for Nominatim geocoder (respx — no real HTTP)."""

import httpx
import pytest
import respx

from app.services.nominatim_geocoding import (
    GeocodeNotFoundError,
    NominatimGeocoder,
)


@pytest.mark.asyncio
@respx.mock
async def test_geocode_full_address_returns_coordinates():
    respx.get("https://nominatim.openstreetmap.org/search").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "lat": "29.558100",
                    "lon": "34.948200",
                    "display_name": "Eilat, Israel",
                }
            ],
        )
    )

    geocoder = NominatimGeocoder(user_agent="CityStrata-test")
    result = await geocoder.geocode_full_address("Eilat, Israel")

    assert result.latitude == pytest.approx(29.5581)
    assert result.longitude == pytest.approx(34.9482)
    assert result.display_name == "Eilat, Israel"


@pytest.mark.asyncio
async def test_geocode_empty_address_raises_not_found():
    geocoder = NominatimGeocoder(user_agent="CityStrata-test")
    with pytest.raises(GeocodeNotFoundError, match="Empty address"):
        await geocoder.geocode_full_address("   ")


@pytest.mark.asyncio
@respx.mock
async def test_geocode_no_results_raises_not_found():
    respx.get("https://nominatim.openstreetmap.org/search").mock(
        return_value=httpx.Response(200, json=[])
    )

    geocoder = NominatimGeocoder(user_agent="CityStrata-test")
    with pytest.raises(GeocodeNotFoundError, match="No results"):
        await geocoder.geocode_full_address("Nowhere XYZ 00000")


@pytest.mark.asyncio
@respx.mock
async def test_geocode_http_error_propagates():
    respx.get("https://nominatim.openstreetmap.org/search").mock(
        return_value=httpx.Response(503, json={"error": "unavailable"})
    )

    geocoder = NominatimGeocoder(user_agent="CityStrata-test")
    with pytest.raises(httpx.HTTPStatusError):
        await geocoder.geocode_full_address("Eilat")
