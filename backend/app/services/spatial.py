"""PostGIS spatial query helpers"""

from typing import Optional, List, Tuple


def build_point_geometry(lat: float, lon: float) -> str:
    """
    Build PostGIS POINT geometry from lat/lon.

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        PostGIS geometry string
    """
    return f"ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)"


def build_spatial_filter(
    lat: float, lon: float, radius_meters: int, geometry_column: str = "location"
) -> Tuple[str, List[float]]:
    """
    Build WHERE clause for spatial radius filter.

    Args:
        lat: Center latitude
        lon: Center longitude
        radius_meters: Radius in meters
        geometry_column: Name of geometry column

    Returns:
        Tuple of (SQL WHERE clause, parameters list)
    """
    point = build_point_geometry(lat, lon)
    where_clause = f"ST_DWithin({geometry_column}::geography, {point}::geography, %s)"
    return where_clause, [radius_meters]


def build_area_filter(
    stat_2022: Optional[int] = None, semel_yish: int = 2600
) -> Tuple[str, List[Any]]:
    """
    Build WHERE clause for statistical area filter.

    Args:
        stat_2022: Statistical area code (optional)
        semel_yish: City code (default 2600 for Eilat)

    Returns:
        Tuple of (SQL WHERE clause, parameters list)
    """
    conditions = [f"semel_yish = %s"]
    params = [semel_yish]

    if stat_2022 is not None:
        conditions.append(f"stat_2022 = %s")
        params.append(stat_2022)

    return " AND ".join(conditions), params
