"""
Registry metadata for generic POI CRUD (manual wiring).

Pair with:
- geocode_address / nominatim_geocoder → lat/lon
- ST_SetSRID(ST_MakePoint(lon, lat), 4326) for geometry
- statistical_areas lookup for stat_2022 (and semel_yish when present)

Validate `category` against PoiCategory before using any string as SQL identifier.

Hotels use public.hotels_listings; restaurants use public.restaurants (repo SQL).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from app.models.poi_generic import PoiCategory


@dataclass(frozen=True, slots=True)
class PoiTableSpec:
    sql_table: str
    """Qualified name, e.g. public.airbnb_listings"""
    pk_column: str
    """uuid or id"""
    semel_yish_column: str | None
    stat_2022_column: str
    name_column: str
    address_column: str
    type_column: str | None
    lat_column: str
    lon_column: str
    geom_column: str
    external_id_column: str | None
    """Column for business id (id, cid, hotelid, etc.) if you generate on insert"""


POI_TABLES: Final[dict[PoiCategory, PoiTableSpec]] = {
    PoiCategory.AIRBNB_LISTINGS: PoiTableSpec(
        sql_table="public.airbnb_listings",
        pk_column="uuid",
        semel_yish_column="semel_yish",
        stat_2022_column="stat_2022",
        name_column="title",
        address_column="location_subtitle",
        type_column=None,
        lat_column="coordinates_latitude",
        lon_column="coordinates_longitude",
        geom_column="location",
        external_id_column="id",
    ),
    PoiCategory.COFFEE_SHOPS: PoiTableSpec(
        sql_table="public.coffee_shops",
        pk_column="uuid",
        semel_yish_column="semel_yish",
        stat_2022_column="stat_2022",
        name_column="title",
        address_column="street",
        type_column="category_name",
        lat_column="location_lat",
        lon_column="location_lng",
        geom_column="location",
        external_id_column="cid",
    ),
    PoiCategory.HOTEL_LISTINGS: PoiTableSpec(
        sql_table="public.hotels_listings",
        pk_column="uuid",
        semel_yish_column="semel_yish",
        stat_2022_column="stat_2022",
        name_column="name",
        address_column="location_fulladdress",
        type_column="type",
        lat_column="coordinates_latitude",
        lon_column="coordinates_longitude",
        geom_column="location",
        external_id_column="hotelid",
    ),
    PoiCategory.MATNASIM: PoiTableSpec(
        sql_table="public.matnasim",
        pk_column="uuid",
        semel_yish_column="semel_yish",
        stat_2022_column="stat_2022",
        name_column="matnas_name",
        address_column="full_address",
        type_column=None,
        lat_column="location_lat",
        lon_column="location_lng",
        geom_column="location",
        external_id_column=None,
    ),
    PoiCategory.RESTAURANTS: PoiTableSpec(
        sql_table="public.restaurants",
        pk_column="uuid",
        semel_yish_column="semel_yish",
        stat_2022_column="stat_2022",
        name_column="title",
        address_column="street",
        type_column="category_name",
        lat_column="location_lat",
        lon_column="location_lng",
        geom_column="location",
        external_id_column="cid",
    ),
    PoiCategory.EDUCATIONAL_INSTITUTIONS: PoiTableSpec(
        sql_table="public.educational_institutions",
        pk_column="id",
        semel_yish_column=None,
        stat_2022_column="stat_2022",
        name_column="institution_name",
        address_column="full_address",
        type_column="education_phase",
        lat_column="lat",
        lon_column="lon",
        geom_column="location",
        external_id_column="institution_code",
    ),
    PoiCategory.SYNAGOGUES: PoiTableSpec(
        sql_table="public.synagogues",
        pk_column="uuid",
        semel_yish_column="semel_yish",
        stat_2022_column="stat_2022",
        name_column="name",
        address_column="address",
        type_column="type",
        lat_column="location_lat",
        lon_column="location_lng",
        geom_column="location",
        external_id_column=None,
    ),
}


def get_spec(category: PoiCategory) -> PoiTableSpec:
    return POI_TABLES[category]


# Columns combined with OR for list ?search= (ILIKE %q% on each, COALESCE for NULL).
POI_SEARCH_COLUMNS: Final[dict[PoiCategory, tuple[str, ...]]] = {
    PoiCategory.AIRBNB_LISTINGS: (
        "title",
        "location_subtitle",
        "description",
        "url",
    ),
    PoiCategory.COFFEE_SHOPS: (
        "title",
        "street",
        "category_name",
        "description",
        "url",
        "website",
    ),
    PoiCategory.HOTEL_LISTINGS: (
        "name",
        "location_fulladdress",
        "type",
        "description",
        "url",
    ),
    PoiCategory.MATNASIM: (
        "matnas_name",
        "full_address",
        "person_in_charge",
        "phone_number",
        "activity_days",
        "number_of_activity_rooms",
        "shelter_and_where",
    ),
    PoiCategory.RESTAURANTS: (
        "title",
        "street",
        "category_name",
        "description",
        "url",
        "website",
    ),
    PoiCategory.EDUCATIONAL_INSTITUTIONS: (
        "institution_code",
        "institution_name",
        "full_address",
        "type_of_supervision",
        "type_of_education",
        "education_phase",
    ),
    PoiCategory.SYNAGOGUES: (
        "name",
        "name_he",
        "type",
        "type_he",
        "address",
    ),
}


def get_search_columns(category: PoiCategory) -> tuple[str, ...]:
    return POI_SEARCH_COLUMNS[category]


def qualified_hotel_table() -> str:
    """Same physical table as POI category hotel_listings (public.hotels_listings)."""
    return POI_TABLES[PoiCategory.HOTEL_LISTINGS].sql_table


def qualified_restaurants_table() -> str:
    """Physical table for GeoJSON /api/restaurants and POI category restaurants (public.restaurants)."""
    return POI_TABLES[PoiCategory.RESTAURANTS].sql_table
