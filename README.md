# CityStrata

CityStrata is a geospatial data-driven project focused on **city classification and community analysis in emergency situations**.  
The project explores how urban areas can be analyzed, classified, and matched to population needs during large-scale evacuation scenarios, with **Eilat, Israel** serving as a primary case study.

## Project Motivation

Recent emergency events in Israel highlighted significant challenges in evacuating populations and integrating them into host cities:

- Lack of structured data about community needs
- Mismatch between available urban services and evacuee characteristics
- Difficulty in making data-driven, real-time decisions

CityStrata aims to address these gaps by building a **geospatial data foundation** that enables future analytical and machine-learning–based classification of urban areas.

---

## Current Scope

At its current stage, the project focuses on:

- Building a **PostGIS-enabled spatial database**
- Ingesting and structuring **official statistical areas data**
- Preparing the groundwork for integrating additional spatial layers (POIs, services, infrastructure)

---

## Data Sources

- **CBS (Central Bureau of Statistics, Israel)**
  - Statistical Areas 2022 (Shapefile)
  - City: Eilat (`SEMEL_YISH = 2600`)
- Future planned sources:
  - OpenStreetMap (POIs)
  - Public municipal and governmental datasets

---

## Repository Structure(for now)

backend/
├── app/ # Core application logic (FastAPI-ready)
│ └── core/ # Configuration and database connection
│
├── scripts/ # ETL / data ingestion scripts
│ └── load_statistical_areas.py
│
├── sql/ # Database schema and initialization scripts
│ ├── 001_enable_extensions.sql
│ └── 002_create_statistical_areas.sql
│
├── data/ # Raw geospatial datasets (CBS SHP)
│ └── cbs/statistical_areas_2022/
│
├── requirements.txt
└── README.md

---

## Database Design (Current)

The core spatial unit is the **statistical area**, stored as a `MultiPolygon` in PostGIS.

Key attributes include:

- Official CBS identifiers
- Geometry (EPSG:4326)
- Precomputed area (m²)
- Centroid point
- Flexible `JSONB` properties for additional metadata

This design supports:

- Spatial joins (e.g., POI → area)
- Distance calculations
- Feature extraction for clustering and ML models

---

## Technology Stack

- **Python 3**
- **PostgreSQL + PostGIS** (via Supabase)
- **GeoPandas / Shapely**
- **asyncpg**
- **FastAPI** (planned)

---

## Current Status

- ✅ PostGIS schema initialized
- ✅ Statistical areas for Eilat ingested successfully (25 areas)
- ⏳ POI ingestion (OpenStreetMap)
- ⏳ Feature engineering & clustering
- ⏳ API layer and visualization

---

## Future Directions

- Integrating POIs (education, healthcare, shelters, services)
- Associating POIs with statistical areas
- Community classification using unsupervised learning
- Decision-support tools for emergency planning

---

## Frontend — pages and UI (summary)

Stack: **React 18**, **Vite**, **React Router**, **Leaflet / react-leaflet**, **Tailwind + shadcn/Radix**, **TanStack Query**. API base URL: `VITE_API_URL` (see `frontend/README.md`).

### `/` — Main map (`MapApp`)

- **Top bar (`AppHeader`)**: branding “CityStrata”, subtitle “Eilat evacuation mapping”, and **`UserBar`** on the right.
- **`UserBar`**: if not signed in — “Guest”, **Sign in** → `/login`, **Sign up** → `/signup`. If signed in — user name (or email), optional **role** badge, **Dashboard** → `/municipality`, **Log out**.
- **Left sidebar (`MapSidebar`)** — six tabs (default tab is **Family**):

  | Tab | Purpose |
  | --- | --- |
  | **Layers** | Map layer toggles, clustering, area details |
  | **Family** | Multi-step **evacuee family profile** wizard (RTL, Hebrew step titles) |
  | **Community** | **Community / group profile** form (create `community_profiles`) |
  | **recommend Family** | List of family profiles, **macro matching** + **tactical** actions, markdown reports; syncs with map highlight |
  | **recommend Community** | Saved **community profiles**, search, **run matching**; Hebrew labels for match block |

- **Layers tab (`MapLayersPanel`)** — **switches** for: statistical areas, educational institutions, Airbnb, restaurants, coffee shops, hotels, matnasim, OSM facilities, synagogues; **Show clusters on map**; **Run clustering** (k=4, then refreshes assignments and can auto-enable cluster layer); if **OSM facilities** on — search, **All** / **None** for facility types, per-type toggles; when a statistical area is selected — **Area details** card (counts/capacity summary) with **close**.
- **Family tab (`EvacueeProfileForm` / `FormWizard`)** — 7 steps: contact, family composition, education, religious/cultural, community, housing, extra; **Back** / **Next**; final step **Submit** (שלח) → `POST /api/evacuee-family-profiles`.
- **Community tab (`CommunityForm`)** — single form: community name, contact, type, composition, cohesion, housing preference, facility needs, notes → saves community profile via API.
- **recommend Family (`RecommendationsPanel`)** — overview list of families; filters with **clear**; row click → detail; per row or detail: **Run matching**, **Run tactical**; optional **community tactical** action where applicable; closes detail with **close** control.
- **recommend Community (`CommunityProfilesPanel`)** — **Refresh**, **search**, list/detail pattern; **Run matching** for a profile; **close** detail.

- **Map (`LeafletMap`)**: OSM tiles, centered on Eilat; layers render when enabled; **statistical areas** support selection and cluster coloring; **RecommendationsLayer** highlights selected recommendation; **LayerControls** injects Leaflet popup/label styles (no visible buttons).

### `/login` — Sign in

- Card form: **email**, **password**, submit; link to signup; redirects after login (e.g. to previous route or `/`).

### `/signup` — Create account

- Card form: name, email, phone, department, password (municipality onboarding); redirects to `/` when logged in.

### `/municipality` — Municipality dashboard (protected)

- **`Sidebar`**: links to **Main map** (`/`), current page **Municipality view**, **POI management** (`/municipality/poi`); **City scope** card (Eilat, semel 2600, current selection); **Clear area selection**; **Refresh data** (invalidates React Query cache).
- **Main**: title switches between “City overview” and selected area; **KPI row** (`StatsCard`): Education, Airbnb, Restaurants, Coffee shops, Hotels, Matnasim, OSM facilities — scoped to all city or **selected statistical area** (click polygon on embedded map).
- **`MapView`**: statistical areas + click to select.
- **`DataPanel`**: insights for current scope — pie chart of POI mix and related copy (see component for full layout).

### `/municipality/hotels` — Hotel management (protected)

- Header: back to **Dashboard**, **Add hotel**; table of hotels with **edit** / **delete**; dialog form (create/edit) with geocoded address.

### `/municipality/poi` — POI management (protected)

- Header: back to **Dashboard**, **Add record**; **category tabs** — Airbnb, coffee shops, educational institutions, hotel listings, matnasim, restaurants, synagogues (`POI_CATEGORIES`, aligned with `/api/poi/{category}`); **search**; paginated table; create/edit in dialog; delete with confirm.

---

## Disclaimer

This project is part of an academic final project and is intended for research and educational purposes.
