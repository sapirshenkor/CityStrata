import { http, HttpResponse, delay } from 'msw'
import {
  makeMatchingResult,
  makeOverviewFixture,
  makeTacticalRecommendation,
} from '../fixtures/recommendations'

const API_BASE = 'http://localhost:8000'

export const recommendationsHandlers = [
  http.get(`${API_BASE}/api/recommendations/overview`, () => {
    return HttpResponse.json(makeOverviewFixture())
  }),

  http.get(`${API_BASE}/api/matching/result/:profileUuid`, ({ params }) => {
    return HttpResponse.json(makeMatchingResult(String(params.profileUuid)))
  }),

  http.get(`${API_BASE}/api/recommendations/:profileUuid`, ({ params }) => {
    return HttpResponse.json(makeTacticalRecommendation(String(params.profileUuid)))
  }),

  http.post(`${API_BASE}/api/matching/cluster/:profileUuid`, ({ params }) => {
    return HttpResponse.json(makeMatchingResult(String(params.profileUuid)))
  }),

  http.post(`${API_BASE}/api/recommendations/run/:profileUuid`, ({ params }) => {
    return HttpResponse.json(makeTacticalRecommendation(String(params.profileUuid)))
  }),

  http.post(`${API_BASE}/api/recommendations/community/run`, () => {
    return HttpResponse.json(makeTacticalRecommendation('44444444-4444-4444-8444-444444444444'))
  }),
]

export function overviewLoadingHandler(ms = 80) {
  return http.get(`${API_BASE}/api/recommendations/overview`, async () => {
    await delay(ms)
    return HttpResponse.json(makeOverviewFixture())
  })
}

export function overviewErrorHandler(message = 'שגיאת מסד נתונים') {
  return http.get(`${API_BASE}/api/recommendations/overview`, () => {
    return HttpResponse.json({ detail: message }, { status: 500 })
  })
}

export function overviewEmptyHandler() {
  return http.get(`${API_BASE}/api/recommendations/overview`, () => {
    return HttpResponse.json([])
  })
}

export function matchingFailureHandler(message = 'הרצת ההתאמה נכשלה') {
  return http.post(`${API_BASE}/api/matching/cluster/:profileUuid`, () => {
    return HttpResponse.json({ detail: message }, { status: 500 })
  })
}
