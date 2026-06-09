import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/config/apiBaseUrl'
import { makeFamilyProfileResponse } from '../fixtures/familyProfiles'

const API_BASE = API_BASE_URL

export const familyHandlers = [
  http.get(`${API_BASE}/api/family/me/profiles`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/api/family/me/profiles/:uuid`, ({ params }) => {
    return HttpResponse.json(
      makeFamilyProfileResponse({ uuid: String(params.uuid) }),
    )
  }),

  http.post(`${API_BASE}/api/family/me/profiles`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    if (body.family_name === 'reject-me') {
      return HttpResponse.json({ detail: 'פרופיל לא תקין' }, { status: 422 })
    }

    return HttpResponse.json(
      makeFamilyProfileResponse(body),
      { status: 201 },
    )
  }),

  http.patch(`${API_BASE}/api/family/me/profiles/:uuid`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      makeFamilyProfileResponse({ uuid: String(params.uuid), ...body }),
    )
  }),
]

/** Capture the last POST body for payload assertions. */
export function createFamilyProfileCapture() {
  let lastPayload: Record<string, unknown> | null = null

  const handler = http.post(`${API_BASE}/api/family/me/profiles`, async ({ request }) => {
    lastPayload = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(makeFamilyProfileResponse(lastPayload), { status: 201 })
  })

  return {
    handler,
    getLastPayload: () => lastPayload,
  }
}
