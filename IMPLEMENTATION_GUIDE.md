# Implementation Guide: Eilat Evacuation Mapping System

This document explains each step of the backend implementation for the CityStrata evacuation mapping system.

## Overview

The backend is a FastAPI application that provides RESTful API endpoints for querying spatial data (statistical areas, institutions, Airbnb listings, restaurants, coffee shops) and performing evacuation analysis. All spatial data is returned in GeoJSON format for easy consumption by mapping libraries like Leaflet.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point with lifecycle events
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Environment variables and settings
│   │   └── database.py         # Database connection pool management
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py           # Main API router that includes all endpoints
│   │   └── endpoints/
│   │       ├── __init__.py
│   │       ├── statistical_areas.py
│   │       ├── institutions.py
│   │       ├── airbnb.py
│   │       ├── restaurants.py
│   │       ├── coffee_shops.py
│   │       ├── evacuation.py
│   │       └── nearby.py
│   ├── models/
│   │   ├── __init__.py         # Exports all models
│   │   ├── common.py           # Shared models (Point, Geometry, GeoJSON)
│   │   ├── statistical_area.py
│   │   ├── institution.py
│   │   ├── airbnb.py
│   │   ├── restaurant.py
│   │   ├── coffee_shop.py
│   │   └── evacuation.py
│   └── services/
│       ├── __init__.py
│       ├── geojson.py          # GeoJSON conversion utilities
│       └── spatial.py          # PostGIS spatial query helpers
```

## Step-by-Step Implementation

### Step 1: Core Infrastructure (`app/core/`)

#### 1.1 Configuration (`config.py`)

- **Purpose**: Loads environment variables from `.env` file
- **Key Features**:
  - Uses `pydantic-settings` for type-safe configuration
  - Automatically finds `.env` file in project root
  - Exports `settings` singleton for use throughout the app
- **Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string (Supabase)
  - `ENV`: Environment name (dev/prod)

#### 1.2 Database Connection (`database.py`)

- **Purpose**: Manages asyncpg connection pool for PostgreSQL
- **Key Features**:
  - Global connection pool (1-10 connections)
  - `init_db_pool()`: Called on app startup
  - `close_db_pool()`: Called on app shutdown
  - `get_pool()`: Returns the pool for use in endpoints
- **Why Connection Pool**: Reuses connections for better performance, avoids connection overhead

### Step 2: Pydantic Models (`app/models/`)

#### 2.1 Common Models (`common.py`)

- **Purpose**: Shared models used across all resources
- **Models**:
  - `Point`: GeoJSON Point geometry
  - `Geometry`: Generic geometry for GeoJSON
  - `GeoJSONFeature`: Single GeoJSON feature
  - `GeoJSONFeatureCollection`: Collection of features
  - `BaseResource`: Base class with `semel_yish`, `stat_2022`, `imported_at`

#### 2.2 Resource Models

Each resource (statistical_area, institution, airbnb, restaurant, coffee_shop) has:

- **Base Model**: Core fields without ID/timestamps
- **Full Model**: Includes ID and imported_at timestamp
- **Create Model**: For creating new records (same as Base)
- **GeoJSON Model**: Properties subset for GeoJSON responses

**Example Structure** (`institution.py`):

```python
EducationalInstitutionBase      # Core fields
EducationalInstitution          # Base + id + imported_at
EducationalInstitutionCreate    # Same as Base (for POST endpoints)
EducationalInstitutionGeoJSON   # Properties for GeoJSON
```

#### 2.3 Evacuation Models (`evacuation.py`)

- **EvacuationRequest**: Input for evacuation analysis
- **EvacuationCapacity**: Capacity info per area
- **EvacuationNeed**: Population needs per area
- **EvacuationAnalysis**: Complete analysis result with recommendations
- **NearbySearchRequest**: Request for nearby resources

### Step 3: Services (`app/services/`)

#### 3.1 GeoJSON Service (`geojson.py`)

- **Purpose**: Utilities for building and parsing GeoJSON
- **Functions**:
  - `build_geojson_feature()`: Creates a single GeoJSON Feature
  - `build_geojson_feature_collection()`: Creates FeatureCollection
  - `parse_postgis_geojson()`: Parses PostGIS ST_AsGeoJSON output

#### 3.2 Spatial Service (`spatial.py`)

- **Purpose**: Helper functions for PostGIS queries
- **Functions**:
  - `build_point_geometry()`: Creates PostGIS POINT from lat/lon
  - `build_spatial_filter()`: Creates ST_DWithin WHERE clause
  - `build_area_filter()`: Creates statistical area filter

### Step 4: API Endpoints (`app/api/endpoints/`)

All endpoints follow a consistent pattern:

1. Accept query parameters for filtering
2. Build SQL query with conditions
3. Execute query using connection pool
4. Convert PostGIS geometry to GeoJSON
5. Return GeoJSON FeatureCollection

#### 4.1 Statistical Areas (`statistical_areas.py`)

- **GET `/api/statistical-areas`**: All 25 areas as GeoJSON
- **GET `/api/statistical-areas/{stat_2022}`**: Single area with geometry
- **GET `/api/statistical-areas/{stat_2022}/summary`**: Area statistics (counts of resources)

**Key Query Pattern**:

```sql
SELECT
    id::text,
    stat_2022,
    ST_AsGeoJSON(geom)::jsonb as geometry,
    properties
FROM statistical_areas
WHERE semel_yish = 2600
```

#### 4.2 Educational Institutions (`institutions.py`)

- **GET `/api/institutions`**: Filter by area, phase, type
- **GET `/api/institutions/{institution_code}`**: Single institution

**Filtering**: Uses dynamic WHERE clause building based on query parameters

#### 4.3 Airbnb Listings (`airbnb.py`)

- **GET `/api/airbnb`**: Filter by area, min_capacity, min_rating, max_price
- **Sorting**: By capacity (DESC) then rating (DESC)

#### 4.4 Restaurants (`restaurants.py`)

- **GET `/api/restaurants`**: Filter by area, category, min_score
- **Filtering**: Excludes permanently closed restaurants

#### 4.5 Coffee Shops (`coffee_shops.py`)

- **GET `/api/coffee-shops`**: Filter by area, min_score
- **Filtering**: Excludes permanently closed shops

#### 4.6 Evacuation Analysis (`evacuation.py`)

- **POST `/api/evacuation/analyze`**: Analyzes evacuation capacity vs. need

**Algorithm**:

1. Get Airbnb capacity for evacuate areas
2. Get institution counts for evacuate areas
3. Estimate population: 30 children + 5 staff per institution
4. Calculate total capacity vs. total need
5. Generate recommendations based on deficit/surplus

**Key Calculations**:

- Capacity: Sum of `person_capacity` from Airbnb listings
- Need: `institutions_count * 35` (30 children + 5 staff)
- Deficit: `total_capacity - total_need` (negative = shortage)

#### 4.7 Nearby Resources (`nearby.py`)

- **GET `/api/nearby`**: Resources within radius of a point
- **Parameters**: lat, lon, radius (meters), type (airbnb/institution/restaurant/coffee_shop)
- **Uses**: PostGIS `ST_DWithin` with geography type for accurate distance calculations

**Query Pattern**:

```sql
SELECT
    *,
    ST_Distance(location::geography, point::geography) as distance_meters
FROM table
WHERE ST_DWithin(location::geography, point::geography, radius)
ORDER BY distance_meters
```

### Step 5: API Router (`app/api/router.py`)

- **Purpose**: Central router that includes all endpoint routers
- **Structure**: Uses FastAPI's `APIRouter` with `/api` prefix
- **Includes**: All 7 endpoint modules

### Step 6: Main Application (`app/main.py`)

- **Purpose**: FastAPI app initialization and configuration
- **Key Features**:
  - CORS middleware for frontend access
  - Lifespan events for database pool management
  - Includes API router

**Lifespan Events**:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pool()  # Startup
    yield
    await close_db_pool()  # Shutdown
```

## Database Query Patterns

### GeoJSON Conversion

All spatial queries use PostGIS `ST_AsGeoJSON()`:

```sql
ST_AsGeoJSON(geom)::jsonb as geometry
```

### Spatial Filtering

For radius searches:

```sql
ST_DWithin(
    location::geography,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    radius_meters
)
```

### Statistical Area Joins

Resources are joined to statistical areas via:

```sql
LEFT JOIN table t ON
    t.semel_yish = sa.semel_yish
    AND t.stat_2022 = sa.stat_2022
```

## Error Handling

All endpoints use consistent error handling:

- **404**: Resource not found
- **400**: Invalid request parameters
- **500**: Database errors (with error message)

## Response Format

All spatial endpoints return GeoJSON FeatureCollection:

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
        "stat_2022": 11,
        ...
      }
    }
  ]
}
```

## Testing the API

### Start the Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Example Requests

**Get all statistical areas**:

```bash
curl http://localhost:8000/api/statistical-areas
```

**Get institutions in area 11**:

```bash
curl "http://localhost:8000/api/institutions?area=11"
```

**Get Airbnb listings with capacity >= 4**:

```bash
curl "http://localhost:8000/api/airbnb?min_capacity=4"
```

**Evacuation analysis**:

```bash
curl -X POST http://localhost:8000/api/evacuation/analyze \
  -H "Content-Type: application/json" \
  -d '{"evacuate_areas": [11, 12], "scenario": "emergency"}'
```

**Nearby resources**:

```bash
curl "http://localhost:8000/api/nearby?lat=29.55&lon=34.95&radius=1000&type=airbnb"
```

## Next Steps

1. **Frontend Implementation**: Create React + Leaflet map application
2. **API Documentation**: Access Swagger UI at `http://localhost:8000/docs`
3. **Testing**: Add unit tests for endpoints
4. **Performance**: Add caching for frequently accessed data
5. **Authentication**: Add API key or JWT authentication if needed

## Key Design Decisions

1. **GeoJSON Format**: Standard format for spatial data, works seamlessly with Leaflet
2. **Connection Pooling**: Reuses database connections for better performance
3. **Async/Await**: All database operations are async for better concurrency
4. **Pydantic Models**: Type safety and automatic validation
5. **Modular Structure**: Each resource has its own endpoint file for maintainability
6. **PostGIS Geography**: Uses geography type for accurate distance calculations (meters)

## Common Issues and Solutions

### Issue: Database connection errors

**Solution**: Check `DATABASE_URL` in `.env` file, ensure Supabase database is accessible

### Issue: Geometry not displaying correctly

**Solution**: Ensure coordinates are in [lon, lat] order (GeoJSON standard)

### Issue: Empty results

**Solution**: Check that `semel_yish = 2600` filter is applied (Eilat city code)

### Issue: Slow queries

**Solution**: Ensure spatial indexes exist on geometry columns in database
