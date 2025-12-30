"""Evacuation Analysis Pydantic models"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class EvacuationRequest(BaseModel):
    """Request model for evacuation analysis"""

    evacuate_areas: List[int]  # List of stat_2022 codes to evacuate
    resource_areas: Optional[List[int]] = None  # Areas with resources
    scenario: str = "emergency"  # emergency, planned, etc.


class EvacuationCapacity(BaseModel):
    """Capacity information for an area"""

    stat_2022: int
    airbnb_capacity: int
    total_capacity: int


class EvacuationNeed(BaseModel):
    """Population/need information for an area"""

    stat_2022: int
    institutions_count: int
    estimated_children: int
    estimated_staff: int
    total_estimated_population: int


class EvacuationAnalysis(BaseModel):
    """Complete evacuation analysis result"""

    evacuate_areas: List[int]
    total_need: int
    total_capacity: int
    capacity_deficit: int  # Negative if shortage, positive if surplus
    capacity_by_area: List[EvacuationCapacity]
    need_by_area: List[EvacuationNeed]
    recommendations: List[str]
    scenario: str


class NearbySearchRequest(BaseModel):
    """Request for nearby resources"""

    lat: float
    lon: float
    radius_meters: int = 1000
    resource_type: str  # 'airbnb', 'institution', 'restaurant', 'coffee_shop'
