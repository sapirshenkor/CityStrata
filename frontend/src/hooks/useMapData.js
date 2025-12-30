import { useState, useEffect } from 'react'
import {
  getStatisticalAreas,
  getInstitutions,
  getAirbnbListings,
  getRestaurants,
  getCoffeeShops,
  getStatisticalAreaSummary,
  getHotels,
  getMatnasim,
  getOSMFacilities,
  getOSMFacilityTypes,
} from '../services/api'

export const useStatisticalAreas = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getStatisticalAreas()
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching statistical areas:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

export const useInstitutions = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getInstitutions(filters)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching institutions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useAirbnbListings = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getAirbnbListings(filters)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching Airbnb listings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useRestaurants = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getRestaurants(filters)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching restaurants:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useCoffeeShops = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getCoffeeShops(filters)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching coffee shops:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useHotels = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getHotels(filters)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching hotels:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useMatnasim = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getMatnasim(filters)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching matnasim:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useOSMFacilities = (filters = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      // Don't fetch if no facility types are selected
      const facilityTypes = filters.facility_types
      if (!facilityTypes || !Array.isArray(facilityTypes) || facilityTypes.length === 0) {
        setData(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // Convert facility_types array to comma-separated string
        const params = { ...filters }
        params.facility_types = facilityTypes.join(',')
        const response = await getOSMFacilities(params)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching OSM facilities:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [JSON.stringify(filters)])

  return { data, loading, error }
}

export const useOSMFacilityTypes = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getOSMFacilityTypes()
        setData(response.data.types)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching OSM facility types:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}

export const useAreaSummary = (stat2022) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!stat2022) {
      setData(null)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await getStatisticalAreaSummary(stat2022)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error('Error fetching area summary:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [stat2022])

  return { data, loading, error }
}

