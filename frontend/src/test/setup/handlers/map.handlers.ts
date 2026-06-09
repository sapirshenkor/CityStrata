import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/config/apiBaseUrl'
import {
  makeEmptyFeatureCollection,
  makeStatisticalAreaSummary,
  makeStatisticalAreasCollection,
} from '../fixtures/geojson'

const API_BASE = API_BASE_URL

export const mapHandlers = [
  http.get(`${API_BASE}/api/statistical-areas`, () => {
    return HttpResponse.json(makeStatisticalAreasCollection())
  }),

  http.get(`${API_BASE}/api/statistical-areas/:stat2022/summary`, ({ params }) => {
    const stat2022 = Number(params.stat2022)
    if (!Number.isFinite(stat2022)) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json(makeStatisticalAreaSummary(stat2022))
  }),

  http.get(`${API_BASE}/api/hotels`, () => HttpResponse.json(makeEmptyFeatureCollection())),
  http.get(`${API_BASE}/api/airbnb`, () => HttpResponse.json(makeEmptyFeatureCollection())),
  http.get(`${API_BASE}/api/property-listings`, () => HttpResponse.json(makeEmptyFeatureCollection())),
  http.get(`${API_BASE}/api/matnasim`, () => HttpResponse.json(makeEmptyFeatureCollection())),
  http.get(`${API_BASE}/api/osm-facilities`, () => HttpResponse.json(makeEmptyFeatureCollection())),
  http.get(`${API_BASE}/api/clustering/assignments`, () => {
    return HttpResponse.json({ run_id: null, assignments: [] })
  }),
]
