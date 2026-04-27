import { useCallback, useEffect } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Feature, GeoJsonObject, GeoJsonProperties } from 'geojson'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { getAreaStyle } from '../utils/colors.js'
import type { GeoJSONFeatureCollection } from '@/types/dashboard'

const EILAT_CENTER: [number, number] = [29.55, 34.95]
const DEFAULT_ZOOM = 13

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function statFromProps(properties: GeoJsonProperties): number {
  if (properties == null || typeof properties !== 'object' || !('stat_2022' in properties)) {
    return NaN
  }
  const raw = (properties as { stat_2022?: unknown }).stat_2022
  return typeof raw === 'number' ? raw : Number(raw)
}

function FitSelectedArea({
  selectedStat2022,
  geojson,
}: {
  selectedStat2022: number | null
  geojson: GeoJSONFeatureCollection | undefined
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedStat2022 == null || !geojson?.features?.length) return
    const feature = geojson.features.find((f) => statFromProps(f.properties) === selectedStat2022)
    if (!feature) return
    const g = feature.geometry
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return
    const ring =
      g.type === 'Polygon'
        ? (g.coordinates as number[][][])[0]
        : (g.coordinates as number[][][][])[0][0]
    const bounds = ring.reduce(
      (acc, coord) => {
        const lat = coord[1]
        const lon = coord[0]
        return [
          [Math.min(acc[0][0], lat), Math.min(acc[0][1], lon)],
          [Math.max(acc[1][0], lat), Math.max(acc[1][1], lon)],
        ] as [[number, number], [number, number]]
      },
      [
        [90, 180],
        [-90, -180],
      ] as [[number, number], [number, number]],
    )
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [selectedStat2022, geojson, map])

  return null
}

export interface MapViewProps {
  geojson: GeoJSONFeatureCollection | undefined
  selectedStat2022: number | null
  onSelectStat2022: (stat2022: number) => void
  loading?: boolean
  errorMessage?: string | null
  onRetry?: () => void
  /** True when the request succeeded but returned no features. */
  isEmpty?: boolean
}

export function MapView({
  geojson,
  selectedStat2022,
  onSelectStat2022,
  loading,
  errorMessage,
  onRetry,
  isEmpty,
}: MapViewProps) {
  const style = useCallback(
    (feature?: Feature) => {
      if (!feature) {
        return getAreaStyle(0, false)
      }
      const stat = statFromProps(feature.properties)
      const isSelected = selectedStat2022 === stat
      return getAreaStyle(stat, isSelected)
    },
    [selectedStat2022],
  )

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const stat = statFromProps(feature.properties)
      layer.on({
        click: () => {
          if (!Number.isNaN(stat)) onSelectStat2022(stat)
        },
      })
      layer.bindTooltip(`אזור סטטיסטי ${stat}`, { sticky: true })
    },
    [onSelectStat2022],
  )

  if (loading) {
    return (
      <div className="dashboard-app__map-frame dashboard-app__map-placeholder flex h-full min-h-[min(240px,42dvh)] w-full flex-1 items-center justify-center rounded-lg lg:min-h-0">
        <p className="text-sm text-muted-foreground">טוען מפה...</p>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="dashboard-app__map-frame flex h-full min-h-[min(240px,42dvh)] w-full flex-1 flex-col items-center justify-center gap-4 rounded-lg border-destructive/30 bg-destructive/5 p-6 text-center lg:min-h-0">
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => onRetry()}>
            נסו שוב
          </Button>
        ) : null}
      </div>
    )
  }

  if (isEmpty || !geojson?.features?.length) {
    return (
      <div className="dashboard-app__map-frame dashboard-app__map-placeholder flex h-full min-h-[min(240px,42dvh)] w-full flex-1 items-center justify-center rounded-lg p-6 text-center lg:min-h-0">
        <p className="max-w-sm text-sm text-muted-foreground">
          לא התקבלו גבולות של אזורים סטטיסטיים. מדדי לוח הבקרה דורשים נתוני גבולות -
          נסו לרענן או בדקו את ה־API.
        </p>
      </div>
    )
  }

  return (
    <div className="dashboard-app__map-frame flex h-full min-h-[min(240px,42dvh)] w-full flex-1 overflow-hidden rounded-lg lg:min-h-0">
      <div dir="ltr" className="h-full min-h-0 w-full flex-1">
        <MapContainer
          center={EILAT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full min-h-[min(200px,35dvh)] w-full lg:min-h-0"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitSelectedArea selectedStat2022={selectedStat2022} geojson={geojson} />
          <GeoJSON
            data={geojson as unknown as GeoJsonObject}
            style={style}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      </div>
    </div>
  )
}
