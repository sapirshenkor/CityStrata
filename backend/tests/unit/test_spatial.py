"""Unit tests for spatial SQL fragment builders."""

from app.services.spatial import build_area_filter, build_point_geometry, build_spatial_filter


def test_build_point_geometry_uses_lon_lat_order():
    sql = build_point_geometry(29.55, 34.95)
    assert "ST_MakePoint(34.95, 29.55)" in sql
    assert "4326" in sql


def test_build_spatial_filter_returns_parameterized_clause():
    clause, params = build_spatial_filter(29.55, 34.95, 500)
    assert "ST_DWithin" in clause
    assert params == [500]


def test_build_area_filter_includes_semel_yish_and_optional_stat():
    clause, params = build_area_filter(stat_2022=100, semel_yish=2600)
    assert "semel_yish" in clause
    assert "stat_2022" in clause
    assert params == [2600, 100]

    clause_only_city, params_only_city = build_area_filter()
    assert params_only_city == [2600]
