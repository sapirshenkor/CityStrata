import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

export default api

