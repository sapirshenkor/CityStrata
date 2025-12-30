# Export all models for easy import
from .common import (
    Point,
    Geometry,
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    BaseResource,
)
from .statistical_area import (
    StatisticalAreaBase,
    StatisticalArea,
    StatisticalAreaGeoJSON,
    StatisticalAreaSummary,
)
from .institution import (
    EducationalInstitutionBase,
    EducationalInstitution,
    EducationalInstitutionCreate,
    EducationalInstitutionGeoJSON,
)
from .airbnb import (
    AirbnbListingBase,
    AirbnbListing,
    AirbnbListingCreate,
    AirbnbListingGeoJSON,
)
from .restaurant import RestaurantBase, Restaurant, RestaurantCreate, RestaurantGeoJSON
from .coffee_shop import CoffeeShopBase, CoffeeShop, CoffeeShopCreate, CoffeeShopGeoJSON
from .hotel import (
    HotelListingBase,
    HotelListing,
    HotelListingCreate,
    HotelListingGeoJSON,
)
from .matnas import MatnasBase, Matnas, MatnasCreate, MatnasGeoJSON
from .osm_facility import (
    OSMFacilityBase,
    OSMFacility,
    OSMFacilityCreate,
    OSMFacilityGeoJSON,
)
from .evacuation import (
    EvacuationRequest,
    EvacuationCapacity,
    EvacuationNeed,
    EvacuationAnalysis,
    NearbySearchRequest,
)

__all__ = [
    # Common
    "Point",
    "Geometry",
    "GeoJSONFeature",
    "GeoJSONFeatureCollection",
    "BaseResource",
    # Statistical Areas
    "StatisticalAreaBase",
    "StatisticalArea",
    "StatisticalAreaGeoJSON",
    "StatisticalAreaSummary",
    # Institutions
    "EducationalInstitutionBase",
    "EducationalInstitution",
    "EducationalInstitutionCreate",
    "EducationalInstitutionGeoJSON",
    # Airbnb
    "AirbnbListingBase",
    "AirbnbListing",
    "AirbnbListingCreate",
    "AirbnbListingGeoJSON",
    # Restaurants
    "RestaurantBase",
    "Restaurant",
    "RestaurantCreate",
    "RestaurantGeoJSON",
    # Coffee Shops
    "CoffeeShopBase",
    "CoffeeShop",
    "CoffeeShopCreate",
    "CoffeeShopGeoJSON",
    # Hotels
    "HotelListingBase",
    "HotelListing",
    "HotelListingCreate",
    "HotelListingGeoJSON",
    # Matnasim
    "MatnasBase",
    "Matnas",
    "MatnasCreate",
    "MatnasGeoJSON",
    # OSM Facilities
    "OSMFacilityBase",
    "OSMFacility",
    "OSMFacilityCreate",
    "OSMFacilityGeoJSON",
    # Evacuation
    "EvacuationRequest",
    "EvacuationCapacity",
    "EvacuationNeed",
    "EvacuationAnalysis",
    "NearbySearchRequest",
]
