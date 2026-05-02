import { useMemo, useEffect, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/mapbox'

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

/**
 * Recommendation relocation radii as Mapbox GeoJSON polygons (fill + stroke), with hover Popup
 * analogous to Leaflet Circle + Tooltip.
 *
 * recommendation : object with radii_data[] — center_lat, center_lng, radius_m; optional hub_label, semantic_score, total_amenities.
 */
export default function RecommendationsLayer({ recommendation }) {
  const mapRef = useMap()?.current
  const [hover, setHover] = useState(null)

  const geojson = useMemo(() => {
    if (!recommendation?.radii_data?.length) return null

    const features = recommendation.radii_data.map((zone, i) => {
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
        geometry: geodesicCirclePolygon(zone.center_lat, zone.center_lng, zone.radius_m),
      }
    })

    return { type: 'FeatureCollection', features }
  }, [recommendation])

  useEffect(() => {
    const mb = typeof mapRef?.getMap === 'function' ? mapRef.getMap() : null
    if (!mb?.on || !geojson?.features?.length) {
      setHover(null)
      return undefined
    }

    const onEnter = (e) => {
      const f = e.features?.[0]
      const p = f?.properties
      if (!p) return
      const ll = e.lngLat ?? mb.unproject?.(e.point)
      setHover(ll ? { lng: ll.lng, lat: ll.lat, props: { ...p } } : null)
      mb.getCanvas().style.cursor = 'pointer'
    }

    const onLeave = () => {
      setHover(null)
      mb.getCanvas().style.cursor = ''
    }

    mb.on('mouseenter', RECOMMENDATIONS_FILL_LAYER_ID, onEnter)
    mb.on('mouseleave', RECOMMENDATIONS_FILL_LAYER_ID, onLeave)

    return () => {
      mb.off('mouseenter', RECOMMENDATIONS_FILL_LAYER_ID, onEnter)
      mb.off('mouseleave', RECOMMENDATIONS_FILL_LAYER_ID, onLeave)
      mb.getCanvas().style.cursor = ''
    }
  }, [mapRef, geojson])

  if (!geojson) return null

  const score = hover?.props ? parseNum(hover.props.semantic_score) : null
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

      {hover && (
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
            {score != null && (
              <div>
                ציון: <b>{(score * 100).toFixed(1)}%</b>
              </div>
            )}
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
