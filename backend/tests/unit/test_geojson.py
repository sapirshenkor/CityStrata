"""Unit tests for GeoJSON helpers."""

import json

from app.services.geojson import (
    build_geojson_feature,
    build_geojson_feature_collection,
    parse_postgis_geojson,
)


def test_build_geojson_feature_wraps_geometry_and_properties():
    geometry = {"type": "Point", "coordinates": [34.95, 29.55]}
    properties = {"id": "a1", "stat_2022": 100}

    feature = build_geojson_feature(geometry, properties)

    assert feature["type"] == "Feature"
    assert feature["geometry"] == geometry
    assert feature["properties"] == properties


def test_build_geojson_feature_collection_preserves_features():
    features = [
        build_geojson_feature({"type": "Point", "coordinates": [1, 2]}, {"n": 1}),
    ]

    collection = build_geojson_feature_collection(features)

    assert collection["type"] == "FeatureCollection"
    assert collection["features"] == features


def test_parse_postgis_geojson_accepts_dict_string_and_none():
    geom = {"type": "Point", "coordinates": [34.95, 29.55]}
    assert parse_postgis_geojson(geom) == geom
    assert parse_postgis_geojson(json.dumps(geom)) == geom
    assert parse_postgis_geojson(None) is None
