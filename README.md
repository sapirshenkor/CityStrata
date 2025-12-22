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

## Disclaimer

This project is part of an academic final project and is intended for research and educational purposes.
