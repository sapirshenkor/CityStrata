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

// Evacuation Analysis
export const analyzeEvacuation = (data) => {
  return api.post('/api/evacuation/analyze', data)
}

// Nearby Resources
export const getNearbyResources = (params) => {
  return api.get('/api/nearby', { params })
}

export default api

