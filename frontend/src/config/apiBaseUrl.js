/** Shared API origin for axios and test mocks (Vite: VITE_API_URL). */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').trim() || 'http://localhost:8000'
