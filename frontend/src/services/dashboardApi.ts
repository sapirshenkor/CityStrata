import api from './api'
import type { GeoJSONFeatureCollection, StatisticalAreaSummary } from '@/types/dashboard'

export async function fetchStatisticalAreas(): Promise<GeoJSONFeatureCollection> {
  const { data } = await api.get<GeoJSONFeatureCollection>('/api/statistical-areas')
  return data
}

export async function fetchStatisticalAreaSummary(stat2022: number): Promise<StatisticalAreaSummary> {
  const { data } = await api.get<StatisticalAreaSummary>(
    `/api/statistical-areas/${stat2022}/summary`,
  )
  return data
}

const VENUE_PATHS = {
  hotels: '/api/hotels',
  matnasim: '/api/matnasim',
  'osm-facilities': '/api/osm-facilities',
} as const

export type VenueResourcePath = keyof typeof VENUE_PATHS

/**
 * Count features in a GeoJSON FeatureCollection for hotels, matnasim, or OSM facilities.
 * When `area` is omitted, counts for the whole municipality (semel_yish scope on the API).
 */
export async function fetchVenueFeatureCount(
  resource: VenueResourcePath,
  area?: number | null,
): Promise<number> {
  const path = VENUE_PATHS[resource]
  const params = area != null ? { area } : {}
  const { data } = await api.get<GeoJSONFeatureCollection>(path, { params })
  return data.features?.length ?? 0
}
