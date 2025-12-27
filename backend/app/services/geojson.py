"""GeoJSON conversion utilities"""

import json
from typing import Dict, Any, List, Optional


def build_geojson_feature(
    geometry: Dict[str, Any], properties: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Build a GeoJSON Feature object.

    Args:
        geometry: Geometry dict with 'type' and 'coordinates'
        properties: Properties dict for the feature

    Returns:
        GeoJSON Feature dict
    """
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def build_geojson_feature_collection(features: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build a GeoJSON FeatureCollection object.

    Args:
        features: List of GeoJSON Feature dicts

    Returns:
        GeoJSON FeatureCollection dict
    """
    return {"type": "FeatureCollection", "features": features}


def parse_postgis_geojson(geojson_data: Any) -> Dict[str, Any]:
    """
    Parse PostGIS ST_AsGeoJSON output to Python dict.
    Handles both jsonb (dict) and string formats.

    Args:
        geojson_data: JSON dict or string from ST_AsGeoJSON()

    Returns:
        Parsed geometry dict or None
    """
    if geojson_data is None:
        return None
    if isinstance(geojson_data, dict):
        return geojson_data
    if isinstance(geojson_data, str):
        return json.loads(geojson_data)
    return geojson_data
