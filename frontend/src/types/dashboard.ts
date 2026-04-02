/**
 * Frontend types aligned with backend Pydantic models under backend/app/models/.
 * See statistical_area.py (StatisticalAreaSummary), common.py (GeoJSON), etc.
 */

/** Mirrors `StatisticalAreaSummary` in statistical_area.py */
export interface StatisticalAreaSummary {
  stat_2022: number
  area_m2: number
  institutions_count: number
  airbnb_count: number
  restaurants_count: number
  coffee_shops_count: number
  total_airbnb_capacity: number | null
}

/** GeoJSON FeatureCollection returned by venue and area endpoints */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONGeometry
  properties: Record<string, unknown>
}

export interface GeoJSONGeometry {
  type: string
  coordinates: unknown
}

/** Aggregated city-wide metrics derived from per-area summaries + venue GeoJSON counts */
export interface DashboardAggregateMetrics {
  area_m2: number
  institutions_count: number
  airbnb_count: number
  restaurants_count: number
  coffee_shops_count: number
  total_airbnb_capacity: number
  hotels_count: number
  matnasim_count: number
  osm_facilities_count: number
}
