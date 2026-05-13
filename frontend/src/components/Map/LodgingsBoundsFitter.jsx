import { useEffect } from 'react'
import { useMap } from 'react-map-gl/mapbox'
import { useAirbnbListings, useHotels, usePropertyListings } from '../../hooks/useMapData'
import { collectLodgingLngLatsForFit, lngLatPointsToBounds } from '../../utils/recommendationZones'

function trySafeFitBounds(mapRef, bounds, options) {
  if (!mapRef?.fitBounds || !bounds) return false
  let mb = null
  try {
    mb = typeof mapRef.getMap === 'function' ? mapRef.getMap() : null
  } catch {
    return false
  }
  if (!mb) return false
  if (typeof mb.isStyleLoaded === 'function' && !mb.isStyleLoaded()) return false
  try {
    mapRef.fitBounds(bounds, options)
    return true
  } catch {
    return false
  }
}

function expandDegenerateBounds(bounds) {
  if (!bounds) return null
  const [[w, s], [e, n]] = bounds
  if (w === e && s === n) {
    const pad = 0.003
    return [
      [w - pad, s - pad],
      [e + pad, n + pad],
    ]
  }
  return bounds
}

/**
 * Fits the map to lodging markers when the user picks radius vs layer scope (no single-listing focus).
 */
export default function LodgingsBoundsFitter({
  recommendation,
  focusedRadiusPriorityIndex,
  lodgingsMapScope,
  focusedListing,
  hotelsFilters,
  airbnbFilters,
}) {
  const mapRef = useMap()?.current
  const { data: hotelsData } = useHotels(hotelsFilters ?? {})
  const { data: airbnbData } = useAirbnbListings(airbnbFilters ?? {})
  const { data: apartmentsData } = usePropertyListings()

  useEffect(() => {
    if (focusedListing) return
    if (!mapRef?.fitBounds) return

    const apartments = Array.isArray(apartmentsData) ? apartmentsData : []
    const hotelFeatures = hotelsData?.features && Array.isArray(hotelsData.features) ? hotelsData.features : []
    const airbnbFeatures = airbnbData?.features && Array.isArray(airbnbData.features) ? airbnbData.features : []

    const pts = collectLodgingLngLatsForFit(
      lodgingsMapScope,
      recommendation,
      focusedRadiusPriorityIndex,
      apartments,
      hotelFeatures,
      airbnbFeatures,
    )
    const rawBounds = lngLatPointsToBounds(pts)
    const bounds = expandDegenerateBounds(rawBounds)
    if (!bounds) return

    const fitOptions = {
      padding: { top: 80, right: 80, bottom: 120, left: 80 },
      maxZoom: 15,
      duration: 650,
    }

    let cancelled = false
    let fitApplied = false
    let mb = null
    try {
      mb = typeof mapRef.getMap === 'function' ? mapRef.getMap() : null
    } catch {
      mb = null
    }

    const applyFit = () => {
      if (cancelled || fitApplied) return
      if (trySafeFitBounds(mapRef, bounds, fitOptions)) {
        fitApplied = true
      }
    }

    if (trySafeFitBounds(mapRef, bounds, fitOptions)) {
      return () => {
        cancelled = true
      }
    }

    const onIdle = () => {
      window.clearTimeout(fallbackTimer)
      applyFit()
    }

    let fallbackTimer = window.setTimeout(applyFit, 320)

    if (mb?.once) {
      mb.once('idle', onIdle)
      return () => {
        cancelled = true
        window.clearTimeout(fallbackTimer)
        try {
          mb.off?.('idle', onIdle)
        } catch {
          /* map destroyed */
        }
      }
    }

    const t = fallbackTimer
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    airbnbData,
    apartmentsData,
    focusedListing,
    focusedRadiusPriorityIndex,
    hotelsData,
    lodgingsMapScope,
    mapRef,
    recommendation,
  ])

  return null
}
