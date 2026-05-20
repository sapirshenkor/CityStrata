import { getAuthToken, setAuthToken } from '@/services/api'
import { TEST_ACCESS_TOKEN } from '../setup/handlers/auth.handlers'
import type { AuthUserFixture } from '../setup/fixtures/users'

export function seedAuthToken(token = TEST_ACCESS_TOKEN) {
  setAuthToken(token)
}

export function clearAuthSession() {
  setAuthToken(null)
  localStorage.clear()
}

export function getStoredAuthToken() {
  return getAuthToken()
}

export function seedAuthenticatedSession(user?: AuthUserFixture, token = TEST_ACCESS_TOKEN) {
  seedAuthToken(token)
  return { user, token }
}
