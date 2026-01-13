"""Statistical Area Pydantic models"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from .common import Geometry


class StatisticalAreaBase(BaseModel):
    """Base model for statistical area"""

    semel_yish: int = 2600
    stat_2022: int
    area_m2: Optional[float] = None
    properties: Optional[Dict[str, Any]] = None
    source: Optional[str] = None


class StatisticalArea(StatisticalAreaBase):
    """Full statistical area model with ID and timestamp"""

    id: str
    imported_at: datetime


class StatisticalAreaGeoJSON(BaseModel):
    """GeoJSON representation of statistical area"""

    type: str = "Feature"
    geometry: Geometry  # Polygon
    properties: Dict[str, Any]


class StatisticalAreaSummary(BaseModel):
    """Summary statistics for an area"""

    stat_2022: int
    area_m2: float
    institutions_count: int
    airbnb_count: int
    restaurants_count: int
    coffee_shops_count: int
    total_airbnb_capacity: Optional[int] = None
