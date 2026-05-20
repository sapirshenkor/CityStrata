"""Unit tests for POI table registry metadata."""

import pytest

from app.models.poi_generic import PoiCategory
from app.services.poi_table_registry import (
    POI_TABLES,
    get_search_columns,
    get_spec,
    qualified_restaurants_table,
)


def test_all_poi_categories_have_table_specs():
    for category in PoiCategory:
        spec = get_spec(category)
        assert spec.sql_table.startswith("public.")
        assert spec.stat_2022_column
        assert spec.geom_column


def test_restaurants_qualified_name_matches_registry():
    assert qualified_restaurants_table() == POI_TABLES[PoiCategory.RESTAURANTS].sql_table


def test_search_columns_are_non_empty_for_each_category():
    for category in PoiCategory:
        cols = get_search_columns(category)
        assert len(cols) >= 1
        assert all(isinstance(c, str) and c for c in cols)


def test_get_spec_rejects_invalid_category():
    with pytest.raises(KeyError):
        get_spec("not-a-category")  # type: ignore[arg-type]
