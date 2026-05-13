import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/mapbox'
import { orderRadiiByLlmNarrative } from '../../utils/recommendationZones'

/** Source / layers on the canonical map instance — attach hover / click on `RECOMMENDATIONS_FILL_LAYER_ID` from parent if needed */
export const RECOMMENDATIONS_SOURCE_ID = 'recommendations-zones'
export const RECOMMENDATIONS_FILL_LAYER_ID = 'recommendations-zones-fill'
export const RECOMMENDATIONS_LINE_LAYER_ID = 'recommendations-zones-line'

/** Best → lesser rank: blue, orange, green (no purple) */
const ZONE_COLORS = ['#2563eb', '#e67e22', '#27ae60']

function formatZoneLabel(hub_label) {
  return (hub_label || 'אזור')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** GeoJSON Polygon exterior ring [[lng, lat], ...], closed ring, ~geodesic circle on WGS84 */
function geodesicCirclePolygon(centerLat, centerLng, radiusM, steps = 64) {
  const R = 6371008.8
  const φ1 = (centerLat * Math.PI) / 180
  const λ1 = (centerLng * Math.PI) / 180
  const angular = radiusM / R
  const ring = []

  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * 2 * Math.PI
    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(angular) + Math.cos(φ1) * Math.sin(angular) * Math.cos(θ),
    )
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(angular) * Math.cos(φ1),
        Math.cos(angular) - Math.sin(φ1) * Math.sin(φ2),
      )
    ring.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI])
  }

  return { type: 'Polygon', coordinates: [ring] }
}

function parseNum(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function featureBounds(feature) {
  const ring = feature?.geometry?.coordinates?.[0]
  if (!Array.isArray(ring) || !ring.length) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  ring.forEach((coord) => {
    const [lng, lat] = coord
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  })

  if (!Number.isFinite(minLng)) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

function mergeBounds(boundsList) {
  if (!boundsList.length) return null
  const [first] = boundsList
  const out = [
    [first[0][0], first[0][1]],
    [first[1][0], first[1][1]],
  ]

  for (let i = 1; i < boundsList.length; i++) {
    const b = boundsList[i]
    out[0][0] = Math.min(out[0][0], b[0][0])
    out[0][1] = Math.min(out[0][1], b[0][1])
    out[1][0] = Math.max(out[1][0], b[1][0])
    out[1][1] = Math.max(out[1][1], b[1][1])
  }

  return out
}

function profileKeyFromRecommendation(recommendation) {
  if (recommendation?.profile_uuid != null && recommendation.profile_uuid !== '') {
    return String(recommendation.profile_uuid)
  }
  return recommendation
}

/**
 * Same animation as manual radius switching; returns whether fitBounds actually ran.
 * When the style is not ready yet (common right after first tactical load), returns false
 * so the caller can retry on `idle`.
 */
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

/**
 * Recommendation relocation radii as Mapbox GeoJSON polygons (fill + stroke), with hover Popup
 * analogous to Leaflet Circle + Tooltip.
 *
 * recommendation : object with radii_data[] — center_lat, center_lng, radius_m; optional hub_label, semantic_score, total_amenities.
 */
function RecommendationsLayer({
  recommendation,
  focusedPriorityIndex: controlledFocusedPriorityIndex,
  onFocusedPriorityIndexChange,
}) {
  const mapRef = useMap()?.current
  const prevProfileKeyRef = useRef(null)
  const [hover, setHover] = useState(null)
  const [uncontrolledFocusedPriorityIndex, setUncontrolledFocusedPriorityIndex] = useState(0)

  const isControlled = typeof controlledFocusedPriorityIndex === 'number'
  const focusedPriorityIndex = isControlled
    ? controlledFocusedPriorityIndex
    : uncontrolledFocusedPriorityIndex

  const setFocusedPriorityIndex = (next) => {
    if (onFocusedPriorityIndexChange) onFocusedPriorityIndexChange(next)
    if (!isControlled) setUncontrolledFocusedPriorityIndex(next)
  }

  const geojson = useMemo(() => {
    if (!recommendation?.radii_data?.length) return null

    const zonesOrdered = orderRadiiByLlmNarrative(
      recommendation.agent_output,
      recommendation.radii_data,
    )
    const features = zonesOrdered
      .map((zone, i) => {
        const lat = Number(zone.center_lat)
        const lng = Number(zone.center_lng)
        const radiusM = Number(zone.radius_m)
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          !Number.isFinite(radiusM) ||
          radiusM <= 0
        ) {
          return null
        }
        const hue = ZONE_COLORS[i % ZONE_COLORS.length]
        return {
          type: 'Feature',
          id: String(zone.hub_label ?? `zone_${i}`),
          properties: {
            hub_label: zone.hub_label ?? '',
            label_title: formatZoneLabel(zone.hub_label),
            radius_m: zone.radius_m,
            semantic_score: zone.semantic_score ?? '',
            total_amenities: zone.total_amenities ?? '',
            fillHex: hue,
            lineHex: hue,
          },
          geometry: geodesicCirclePolygon(lat, lng, radiusM),
        }
      })
      .filter(Boolean)

    if (!features.length) return null
    return { type: 'FeatureCollection', features }
  }, [recommendation])

  const zoneCount = geojson?.features?.length ?? 0

  useEffect(() => {
    if (recommendation == null) {
      prevProfileKeyRef.current = null
    }
  }, [recommendation])

  useEffect(() => {
    if (zoneCount > 0) setFocusedPriorityIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation, zoneCount])

  useEffect(() => {
    if (!mapRef?.fitBounds || !geojson?.features?.length || !recommendation) return

    const profileKey = profileKeyFromRecommendation(recommendation)
    const isNewSelection = prevProfileKeyRef.current !== profileKey
    prevProfileKeyRef.current = profileKey

    const n = geojson.features.length
    const idx = (() => {
      if (isNewSelection) return 0
      if (focusedPriorityIndex === -1) return -1
      return Math.min(Math.max(0, focusedPriorityIndex), n - 1)
    })()

    const currentBounds =
      idx === -1
        ? mergeBounds(geojson.features.map(featureBounds).filter(Boolean))
        : featureBounds(geojson.features[idx])

    if (!currentBounds) return

    const fitOptions = {
      padding: { top: 70, right: 70, bottom: 70, left: 70 },
      maxZoom: idx === -1 ? 14 : 15,
      duration: 700,
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
      if (trySafeFitBounds(mapRef, currentBounds, fitOptions)) {
        fitApplied = true
      }
    }

    if (trySafeFitBounds(mapRef, currentBounds, fitOptions)) {
      return () => {
        cancelled = true
      }
    }

    const onIdle = () => {
      window.clearTimeout(fallbackTimer)
      applyFit()
    }

    let fallbackTimer = window.setTimeout(applyFit, 300)

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
  }, [mapRef, geojson, recommendation, focusedPriorityIndex])

  useEffect(() => {
    let mb = null
    try {
      mb = typeof mapRef?.getMap === 'function' ? mapRef.getMap() : null
    } catch {
      return undefined
    }
    if (!mb?.on || !geojson?.features?.length) {
      setHover(null)
      return undefined
    }

    const onEnter = (e) => {
      const f = e.features?.[0]
      const p = f?.properties
      if (!p) return
      const ll = e.lngLat ?? mb.unproject?.(e.point)
      if (
        !ll ||
        !Number.isFinite(ll.lng) ||
        !Number.isFinite(ll.lat)
      ) {
        return
      }
      setHover({ lng: ll.lng, lat: ll.lat, props: { ...p } })
      try {
        mb.getCanvas().style.cursor = 'pointer'
      } catch {
        /* map destroyed */
      }
    }

    const onLeave = () => {
      setHover(null)
      try {
        mb.getCanvas().style.cursor = ''
      } catch {
        /* map destroyed */
      }
    }

    mb.on('mouseenter', RECOMMENDATIONS_FILL_LAYER_ID, onEnter)
    mb.on('mouseleave', RECOMMENDATIONS_FILL_LAYER_ID, onLeave)

    return () => {
      try {
        mb.off('mouseenter', RECOMMENDATIONS_FILL_LAYER_ID, onEnter)
        mb.off('mouseleave', RECOMMENDATIONS_FILL_LAYER_ID, onLeave)
        mb.getCanvas().style.cursor = ''
      } catch {
        /* map may already be destroyed during navigation */
      }
    }
  }, [mapRef, geojson])

  if (!geojson) return null

  const amenities = hover?.props ? parseNum(hover.props.total_amenities) : null

  return (
    <>
      <Source id={RECOMMENDATIONS_SOURCE_ID} type="geojson" data={geojson}>
        <Layer
          id={RECOMMENDATIONS_FILL_LAYER_ID}
          type="fill"
          paint={{
            'fill-color': ['get', 'fillHex'],
            'fill-opacity': 0.1,
          }}
        />
        <Layer
          id={RECOMMENDATIONS_LINE_LAYER_ID}
          type="line"
          paint={{
            'line-color': ['get', 'lineHex'],
            'line-width': 2.5,
            'line-opacity': 1,
          }}
        />
      </Source>

      {zoneCount > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(15,23,42,0.9)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 10,
            padding: 8,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() =>
              setFocusedPriorityIndex((prev) => {
                if (prev === -1) return 0
                return (prev - 1 + zoneCount) % zoneCount
              })
            }
            style={{ border: 0, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() =>
              setFocusedPriorityIndex((prev) => {
                if (prev === -1) return 0
                return (prev + 1) % zoneCount
              })
            }
            style={{ border: 0, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => setFocusedPriorityIndex(-1)}
            style={{
              border: 0,
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              background: focusedPriorityIndex === -1 ? '#2563eb' : '#f3f4f6',
              color: focusedPriorityIndex === -1 ? '#fff' : '#111827',
            }}
          >
            All
          </button>
          <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {focusedPriorityIndex === -1
              ? `All (${zoneCount})`
              : `Priority ${focusedPriorityIndex + 1}/${zoneCount}`}
          </span>
        </div>
      )}

      {hover && Number.isFinite(hover.lng) && Number.isFinite(hover.lat) && (
        <Popup
          longitude={hover.lng}
          latitude={hover.lat}
          anchor="bottom"
          offset={8}
          closeButton={false}
          closeOnClick={false}
          maxWidth="220px"
        >
          <div style={{ minWidth: 140, paddingRight: 4 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>
              {hover.props.label_title || formatZoneLabel(hover.props.hub_label)}
            </strong>
            <div>
              רדיוס: <b>{hover.props.radius_m} מ&apos;</b>
            </div>
            {amenities != null && (
              <div>
                שירותים זמינים: <b>{amenities}</b>
              </div>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}

export default memo(RecommendationsLayer)
