# Project Setup: Eilat Evacuation Mapping System

## Project Overview

Build a web application for emergency evacuation planning in Eilat, Israel. The system maps statistical areas with educational institutions, Airbnb listings, restaurants, and coffee shops to help plan evacuation routes and capacity.

## Tech Stack

- **Backend**: FastAPI (Python) + PostGIS (Supabase)
- **Frontend**: React + Leaflet
- **Database**: PostgreSQL with PostGIS extension (hosted on Supabase)

## Database Schema (Already exists in Supabase)

### Tables:

1. **statistical_areas**

   - Columns: id (uuid), semel_yish (int, default 2600), stat_2022 (int), geom (geometry polygon), area_m2 (double), centroid (geometry point), properties (jsonb), source (text), imported_at (timestamptz)
   - Unique constraint: (semel_yish, stat_2022)

2. **educational_institutions**

   - Columns: id (uuid), institution_code (text unique), institution_name (text), address (text), full_address (text), type_of_supervision (text), type_of_education (text), education_phase (text), location (geometry point), lat (double), lon (double), semel_yish (int default 2600), stat_2022 (int), imported_at (timestamptz)
   - Foreign key: (semel_yish, stat_2022) → statistical_areas

3. **airbnb_listings**

   - Columns: uuid (uuid pk), id (bigint unique), url (text), title (text), description (text), price_qualifier (text), price_numeric (int), num_nights (int), price_per_night (double), rating_value (double), person_capacity (int), location_subtitle (text), coordinates_latitude (double), coordinates_longitude (double), location (geometry point), semel_yish (int default 2600), stat_2022 (int), imported_at (timestamptz)
   - Foreign key: (semel_yish, stat_2022) → statistical_areas

4. **coffee_shops**

   - Columns: uuid (uuid pk), cid (numeric unique), title (text), description (text), category_name (text), total_score (double), temporarily_closed (bool), permanently_closed (bool), url (text), website (text), street (text), location_lat (double), location_lng (double), location (geometry point), semel_yish (int default 2600), stat_2022 (int), activity_times (jsonb), imported_at (timestamptz)
   - Foreign key: (semel_yish, stat_2022) → statistical_areas

5. **restaurants**
   - Same structure as coffee_shops

## Backend Requirements (FastAPI)

### Project Structure:

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Environment variables, Supabase connection
│   │   └── database.py         # Database connection pool
│   ├── api/
│   │   ├── __init__.py
│   │   ├── endpoints/
│   │   │   ├── __init__.py
│   │   │   ├── statistical_areas.py
│   │   │   ├── institutions.py
│   │   │   ├── airbnb.py
│   │   │   ├── restaurants.py
│   │   │   ├── coffee_shops.py
│   │   │   └── evacuation.py
│   │   └── router.py           # Main router
│   ├── models/
│   │   ├── __init__.py
│   │   ├── statistical_area.py      # StatisticalArea Pydantic models
│   │   ├── institution.py           # EducationalInstitution models
│   │   ├── airbnb.py                # AirbnbListing models
│   │   ├── restaurant.py            # Restaurant models
│   │   ├── coffee_shop.py           # CoffeeShop models
│   │   ├── evacuation.py            # Evacuation analysis models
│   │   └── common.py                # Shared models (GeoJSON, Point, etc.)
│   └── services/
│       ├── __init__.py
│       ├── geojson.py          # GeoJSON conversion utilities
│       └── spatial.py          # PostGIS spatial query helpers
├── requirements.txt
└── .env                        # Supabase URL, API keys
```

### Model Files Structure:

#### models/common.py

```python
# Shared Pydantic models used across all resources
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class Point(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]

class Geometry(BaseModel):
    type: str
    coordinates: Any

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Geometry
    properties: dict

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]

class BaseResource(BaseModel):
    """Base model for all resources with location"""
    semel_yish: int = 2600
    stat_2022: int
    imported_at: Optional[datetime] = None
```

#### models/statistical_area.py

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from .common import Geometry

class StatisticalAreaBase(BaseModel):
    semel_yish: int = 2600
    stat_2022: int
    area_m2: Optional[float] = None
    properties: Optional[Dict[str, Any]] = None
    source: Optional[str] = None

class StatisticalArea(StatisticalAreaBase):
    id: str
    imported_at: datetime

class StatisticalAreaGeoJSON(BaseModel):
    """GeoJSON representation"""
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
```

#### models/institution.py

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource, Point

class EducationalInstitutionBase(BaseModel):
    institution_code: str
    institution_name: str
    address: Optional[str] = None
    full_address: Optional[str] = None
    type_of_supervision: Optional[str] = None
    type_of_education: Optional[str] = None
    education_phase: Optional[str] = None
    lat: float
    lon: float

class EducationalInstitution(EducationalInstitutionBase, BaseResource):
    id: str

class EducationalInstitutionCreate(EducationalInstitutionBase):
    pass

class EducationalInstitutionGeoJSON(BaseModel):
    """GeoJSON properties for institution"""
    institution_code: str
    institution_name: str
    address: Optional[str]
    education_phase: Optional[str]
    type_of_education: Optional[str]
    stat_2022: int
```

#### models/airbnb.py

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource

class AirbnbListingBase(BaseModel):
    id: int  # Airbnb listing ID
    url: Optional[str] = None
    title: str
    description: Optional[str] = None
    price_qualifier: Optional[str] = None
    price_numeric: Optional[int] = None
    num_nights: Optional[int] = None
    price_per_night: Optional[float] = None
    rating_value: Optional[float] = None
    person_capacity: Optional[int] = None
    location_subtitle: Optional[str] = None
    coordinates_latitude: float
    coordinates_longitude: float

class AirbnbListing(AirbnbListingBase, BaseResource):
    uuid: str

class AirbnbListingCreate(AirbnbListingBase):
    pass

class AirbnbListingGeoJSON(BaseModel):
    """GeoJSON properties for Airbnb"""
    id: int
    title: str
    price_per_night: Optional[float]
    rating_value: Optional[float]
    person_capacity: Optional[int]
    url: Optional[str]
    stat_2022: int
```

#### models/restaurant.py

```python
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from .common import BaseResource

class RestaurantBase(BaseModel):
    cid: str  # Numeric as string to handle large numbers
    title: str
    description: Optional[str] = None
    category_name: Optional[str] = None
    total_score: Optional[float] = None
    temporarily_closed: bool = False
    permanently_closed: bool = False
    url: Optional[str] = None
    website: Optional[str] = None
    street: Optional[str] = None
    location_lat: float
    location_lng: float
    activity_times: Optional[Dict[str, Any]] = None

class Restaurant(RestaurantBase, BaseResource):
    uuid: str

class RestaurantCreate(RestaurantBase):
    pass

class RestaurantGeoJSON(BaseModel):
    """GeoJSON properties for restaurant"""
    cid: str
    title: str
    category_name: Optional[str]
    total_score: Optional[float]
    temporarily_closed: bool
    permanently_closed: bool
    url: Optional[str]
    stat_2022: int
```

#### models/coffee_shop.py

```python
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from .common import BaseResource

class CoffeeShopBase(BaseModel):
    cid: str  # Numeric as string to handle large numbers
    title: str
    description: Optional[str] = None
    category_name: Optional[str] = None
    total_score: Optional[float] = None
    temporarily_closed: bool = False
    permanently_closed: bool = False
    url: Optional[str] = None
    website: Optional[str] = None
    street: Optional[str] = None
    location_lat: float
    location_lng: float
    activity_times: Optional[Dict[str, Any]] = None

class CoffeeShop(CoffeeShopBase, BaseResource):
    uuid: str

class CoffeeShopCreate(CoffeeShopBase):
    pass

class CoffeeShopGeoJSON(BaseModel):
    """GeoJSON properties for coffee shop"""
    cid: str
    title: str
    category_name: Optional[str]
    total_score: Optional[float]
    temporarily_closed: bool
    permanently_closed: bool
    url: Optional[str]
    stat_2022: int
```

#### models/evacuation.py

```python
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
```

#### models/**init**.py

```python
# Export all models for easy import
from .common import (
    Point,
    Geometry,
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    BaseResource
)
from .statistical_area import (
    StatisticalAreaBase,
    StatisticalArea,
    StatisticalAreaGeoJSON,
    StatisticalAreaSummary
)
from .institution import (
    EducationalInstitutionBase,
    EducationalInstitution,
    EducationalInstitutionCreate,
    EducationalInstitutionGeoJSON
)
from .airbnb import (
    AirbnbListingBase,
    AirbnbListing,
    AirbnbListingCreate,
    AirbnbListingGeoJSON
)
from .restaurant import (
    RestaurantBase,
    Restaurant,
    RestaurantCreate,
    RestaurantGeoJSON
)
from .coffee_shop import (
    CoffeeShopBase,
    CoffeeShop,
    CoffeeShopCreate,
    CoffeeShopGeoJSON
)
from .evacuation import (
    EvacuationRequest,
    EvacuationCapacity,
    EvacuationNeed,
    EvacuationAnalysis,
    NearbySearchRequest
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
    # Evacuation
    "EvacuationRequest",
    "EvacuationCapacity",
    "EvacuationNeed",
    "EvacuationAnalysis",
    "NearbySearchRequest",
]
```

### Required API Endpoints:

#### Statistical Areas:

- `GET /api/statistical-areas` - Return all 25 statistical areas as GeoJSON FeatureCollection
- `GET /api/statistical-areas/{stat_2022}` - Get specific area with summary statistics
- `GET /api/statistical-areas/{stat_2022}/summary` - Get detailed statistics (counts of all resources in area)

#### Educational Institutions:

- `GET /api/institutions` - Query params: ?area={stat_2022}&phase={education_phase}&type={type_of_education}
- `GET /api/institutions/{institution_code}` - Get specific institution
- Return as GeoJSON

#### Airbnb:

- `GET /api/airbnb` - Query params: ?area={stat_2022}&min_capacity={capacity}&min_rating={rating}&max_price={price_per_night}
- Return as GeoJSON

#### Restaurants:

- `GET /api/restaurants` - Query params: ?area={stat_2022}&category={category_name}&min_score={total_score}
- Return as GeoJSON

#### Coffee Shops:

- `GET /api/coffee-shops` - Query params: ?area={stat_2022}&min_score={total_score}
- Return as GeoJSON

#### Evacuation Analysis:

- `POST /api/evacuation/analyze` - Body: EvacuationRequest model
  - Calculate total capacity from Airbnb
  - Calculate population from institutions (children + staff estimate)
  - Return EvacuationAnalysis model

#### Spatial Queries:

- `GET /api/nearby` - Query params: ?lat={lat}&lon={lon}&radius={meters}&type={resource_type}
- Return resources within radius

### GeoJSON Response Format:

All spatial endpoints should return GeoJSON in this format:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [34.95, 29.55]
      },
      "properties": {
        "id": "...",
        "name": "...",
        "stat_2022": 11
        // ... other properties
      }
    }
  ]
}
```

### Database Connection:

- Use asyncpg for async PostgreSQL connections
- Connection pool for performance
- Environment variables for Supabase credentials

### PostGIS Queries:

Use ST_AsGeoJSON() to convert geometry to GeoJSON format in SQL queries.

Example query pattern:

```sql
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(location)::jsonb,
      'properties', jsonb_build_object(
        'id', uuid::text,
        'title', title,
        'stat_2022', stat_2022
      )
    )
  )
) as geojson
FROM airbnb_listings
WHERE stat_2022 = $1;
```

## Frontend Requirements (React + Leaflet)

### Project Structure:

```
frontend/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── Map/
│   │   │   ├── LeafletMap.jsx         # Main map component
│   │   │   ├── StatisticalAreasLayer.jsx
│   │   │   ├── InstitutionsLayer.jsx
│   │   │   ├── AirbnbLayer.jsx
│   │   │   ├── RestaurantsLayer.jsx
│   │   │   ├── CoffeeShopsLayer.jsx
│   │   │   └── LayerControls.jsx      # Toggle layers on/off
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── AreaDetails.jsx        # Show stats for selected area
│   │   │   ├── FilterPanel.jsx        # Filter resources
│   │   │   └── EvacuationPlanner.jsx  # Evacuation scenario tool
│   │   └── UI/
│   │       ├── Popup.jsx
│   │       └── Legend.jsx
│   ├── services/
│   │   └── api.js                      # API client for backend
│   ├── hooks/
│   │   └── useMapData.js               # React hooks for fetching data
│   └── utils/
│       ├── colors.js                   # Color schemes for map
│       └── formatters.js               # Format numbers, dates, etc.
├── package.json
└── .env                                # Backend API URL
```

### Map Features:

1. **Base Map**: OpenStreetMap tiles centered on Eilat (lat: 29.55, lon: 34.95)
2. **Statistical Areas Layer**:
   - Display 25 polygons with different colors
   - Click to select/highlight
   - Show area number label at centroid
3. **Point Layers** (toggleable):
   - Educational institutions (school icon)
   - Airbnb (home icon)
   - Restaurants (fork-knife icon)
   - Coffee shops (coffee icon)
4. **Interactions**:
   - Click polygon → highlight + show statistics in sidebar
   - Click marker → show popup with details
   - Layer controls to toggle visibility
   - Filters for each resource type
5. **Evacuation Planner**:
   - Select multiple areas to evacuate
   - Show total capacity vs. need
   - Highlight resource areas

### Leaflet Libraries to Use:

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-leaflet": "^4.x",
    "leaflet": "^1.9.x",
    "axios": "^1.x"
  }
}
```

### Initial Map Setup:

```javascript
// Map centered on Eilat
const center = [29.55, 34.95];
const zoom = 13;
```

## Environment Variables

### Backend (.env):

```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env):

```
VITE_API_URL=http://localhost:8000
```

## Development Setup Instructions

### Backend:

1. Create virtual environment
2. Install dependencies: fastapi, uvicorn, asyncpg, python-dotenv, pydantic
3. Set up Supabase connection
4. Run: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### Frontend:

1. Create Vite React app
2. Install dependencies: react-leaflet, leaflet, axios
3. Run: `npm run dev`

## Implementation Priority

1. Backend: Statistical areas endpoint (GET all areas as GeoJSON)
2. Frontend: Basic Leaflet map showing areas
3. Backend: Institutions endpoint
4. Frontend: Add institutions layer
5. Backend: Airbnb, Restaurants, Coffee shops endpoints
6. Frontend: Add all point layers with controls
7. Backend: Evacuation analysis endpoint
8. Frontend: Evacuation planner UI

## Notes

- All coordinates are in EPSG:4326 (WGS84 lat/lon)
- GeoJSON is the standard format for spatial data exchange
- Use CORS middleware in FastAPI to allow frontend requests
- Add error handling for all API endpoints
- Include loading states in frontend components
- All areas have semel_yish = 2600 (Eilat city code)
- Each model file represents one database table/entity
- Models include base, full, create, and GeoJSON variants for flexibility

Please set up the complete project structure with all files, implement the core backend API endpoints with the separate model files, and create the basic frontend map with statistical areas layer. Start with a working prototype that displays the map and areas, then we'll add features incrementally.
