import api, { setAuthToken } from './api'

/**
 * Municipality auth (FastAPI /api/auth/*).
 * Login stores the access token via setAuthToken (see api.js).
 */
export async function signup(payload) {
  const { data } = await api.post('/api/auth/signup', payload)
  return data
}

export async function login(payload) {
  const { data } = await api.post('/api/auth/login', payload)
  if (data.access_token) {
    setAuthToken(data.access_token)
  }
  return data
}

export async function logout() {
  try {
    await api.post('/api/auth/logout')
  } finally {
    setAuthToken(null)
  }
}

export async function fetchCurrentUser() {
  const { data } = await api.get('/api/auth/me')
  return data
}
