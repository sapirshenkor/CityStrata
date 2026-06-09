import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/config/apiBaseUrl'
import { makeAuthUser, makeLoginResponse, TEST_ACCESS_TOKEN } from '../fixtures/users'

const API_BASE = API_BASE_URL

export const authHandlers = [
  http.get(`${API_BASE}/api/auth/me`, () => {
    return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }),

  http.post(`${API_BASE}/api/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }

    if (body.password === 'wrong-password') {
      return HttpResponse.json({ detail: 'Invalid email or password' }, { status: 401 })
    }

    const user = makeAuthUser({ email: body.email ?? 'editor@example.com' })
    return HttpResponse.json(makeLoginResponse(user))
  }),

  http.post(`${API_BASE}/api/auth/signup`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
      },
      { status: 201 },
    )
  }),

  http.post(`${API_BASE}/api/auth/logout`, () => {
    return HttpResponse.json({ ok: true })
  }),
]

/** Override /me for authenticated integration tests. */
export function meHandlerAs(user = makeAuthUser()) {
  return http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(user))
}

export function loginHandlerAs(user = makeAuthUser()) {
  return http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json(makeLoginResponse(user)))
}

export { TEST_ACCESS_TOKEN }
