import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'citystrata_access_token'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/** Persist JWT for Authorization header on API calls. Pass null to clear. */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Statistical Areas
export const getStatisticalAreas = () => {
  return api.get('/api/statistical-areas')
}

export const getStatisticalArea = (stat2022) => {
  return api.get(`/api/statistical-areas/${stat2022}`)
}

export const getStatisticalAreaSummary = (stat2022) => {
  return api.get(`/api/statistical-areas/${stat2022}/summary`)
}

// Educational Institutions
export const getInstitutions = (params = {}) => {
  return api.get('/api/institutions', { params })
}

export const getInstitution = (institutionCode) => {
  return api.get(`/api/institutions/${institutionCode}`)
}

// Airbnb Listings
export const getAirbnbListings = (params = {}) => {
  return api.get('/api/airbnb', { params })
}

// Restaurants
export const getRestaurants = (params = {}) => {
  return api.get('/api/restaurants', { params })
}

// Coffee Shops
export const getCoffeeShops = (params = {}) => {
  return api.get('/api/coffee-shops', { params })
}

// Hotels
export const getHotels = (params = {}) => {
  return api.get('/api/hotels', { params })
}

// Matnasim
export const getMatnasim = (params = {}) => {
  return api.get('/api/matnasim', { params })
}

// OSM Facilities
export const getOSMFacilities = (params = {}) => {
  return api.get('/api/osm-facilities', { params })
}

export const getOSMFacilityTypes = () => {
  return api.get('/api/osm-facilities/types')
}

// Synagogues
export const getSynagogues = (params = {}) => {
  return api.get('/api/synagogues', { params })
}

// Evacuation Analysis
export const analyzeEvacuation = (data) => {
  return api.post('/api/evacuation/analyze', data)
}

// Nearby Resources
export const getNearbyResources = (params) => {
  return api.get('/api/nearby', { params })
}

// Clustering
export const runClustering = (k = 4) => {
  return api.post(`/api/clustering/run?k=${k}`)
}

export const getClusterAssignments = (runId = null) => {
  const params = runId ? { run_id: runId } : {}
  return api.get('/api/clustering/assignments', { params })
}

export const getClusterProfiles = (runId = null) => {
  const params = runId ? { run_id: runId } : {}
  return api.get('/api/clustering/profiles', { params })
}

// Tactical Recommendations
export const getRecommendations = () => {
  return api.get('/api/recommendations')
}

export const getRecommendationByProfile = (profileUuid) => {
  return api.get(`/api/recommendations/${profileUuid}`)
}

/** All families + has_matching / has_tactical (Recommendations overview list). */
export const getRecommendationsOverview = () => {
  return api.get('/api/recommendations/overview')
}
/** Selected macro matching row for a profile (DB link via selected_matching_result_id). */
export const getMatchingResultForProfile = (profileUuid) => {
  return api.get(`/api/matching/result/${profileUuid}`)
}

/** Macro matching agent for an existing profile (sets selected_matching_result_id). */
export const runMatchingForProfile = (profileUuid) => {
  return api.post(`/api/matching/cluster/${profileUuid}`, null, {
    timeout: 120_000,
  })
}

/** Tactical agent (can take several minutes — MCP + DB + optional GPT). */
export const runTacticalForProfile = (profileUuid) => {
  return api.post(`/api/recommendations/run/${profileUuid}`, null, {
    timeout: 600_000,
  })
}

/** Community tactical: merge families + centroid pipeline; creates a new merged profile. */
export const runCommunityTactical = (familyUuids) => {
  return api.post(
    '/api/recommendations/community/run',
    { family_uuids: familyUuids },
    { timeout: 600_000 },
  )
}

/** Collective community profiles (neighborhood / kibbutz / etc.) — CRUD list. */
export const getCommunityProfiles = () => {
  return api.get('/api/communities')
}

export const getCommunityProfile = (communityId) => {
  return api.get(`/api/communities/${communityId}`)
}

/** Macro cluster matching for a saved community_profiles row (OpenAI + DB). */
export const runMatchingForCommunityProfile = (communityId) => {
  return api.post(`/api/matching/cluster/community/${communityId}`, null, {
    timeout: 120_000,
  })
}

export const getMatchingResultForCommunity = (communityId) => {
  return api.get(`/api/matching/result/community/${communityId}`)
}

// Family portal (JWT required; scoped to current user)
export const getFamilyDashboard = () => api.get('/api/family/me/dashboard')

export const getFamilyProfiles = () => api.get('/api/family/me/profiles')

export const getFamilyProfile = (profileUuid) =>
  api.get(`/api/family/me/profiles/${profileUuid}`)

export const createFamilyProfile = (payload) =>
  api.post('/api/family/me/profiles', payload)

export const updateFamilyProfile = (profileUuid, payload) =>
  api.patch(`/api/family/me/profiles/${profileUuid}`, payload)

export default api

