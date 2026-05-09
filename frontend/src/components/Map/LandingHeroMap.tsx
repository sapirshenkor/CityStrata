import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPinned } from 'lucide-react'
import LeafletMap from './LeafletMap'
import type { LayerVisibility } from './MapLayersPanel'

const previewLayerVisibility: LayerVisibility = {
  statisticalAreas: true,
  institutions: false,
  airbnb: false,
  restaurants: false,
  coffeeShops: false,
  hotels: false,
  apartments: false,
  matnasim: false,
  osmFacilities: false,
  synagogues: false,
  clusters: false,
}

const previewFilters: Record<string, unknown> = {
  institutions: {},
  airbnb: {},
  restaurants: {},
  coffeeShops: {},
  hotels: {},
  apartments: {},
  matnasim: {},
  osmFacilities: {},
  synagogues: {},
}

function MapUnavailableFallback() {
  return (
    <div
      className="relative flex min-h-[420px] flex-col justify-center overflow-hidden rounded-[2rem] border border-border/70 bg-card px-8 py-12 shadow-card md:min-h-[560px]"
      role="img"
      aria-label="תצוגת מפה — נדרש מפתח Mapbox להצגת מפה חיה"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-primary/8" />
      <div className="relative text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <MapPinned className="h-7 w-7" aria-hidden />
        </div>
        <p className="text-sm font-medium text-foreground">תצוגת מפה חיה אינה זמינה בהגדרות הנוכחיות</p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          ניתן להמשיך למפת המערכת המלאה עם כל השכבות והכלים.
        </p>
        <Link
          to="/map"
          className="mt-8 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          כניסה למפת המערכת
        </Link>
      </div>
    </div>
  )
}

export default function LandingHeroMap() {
  const token = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '').trim()
  const [layerVisibility] = useState<LayerVisibility>(previewLayerVisibility)
  const [filters] = useState(previewFilters)
  const noop = useMemo(() => () => {}, [])
  const noopCluster = useMemo(() => async () => {}, [])

  if (!token) {
    return <MapUnavailableFallback />
  }

  return (
    <div
      className="flex min-h-[420px] flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-card md:min-h-[560px]"
      aria-label="תצוגת מפה חיה — אזורים סטטיסטיים באילת"
    >
      <div className="pointer-events-none z-10 mx-4 mt-4 flex shrink-0 items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-xs text-muted-foreground shadow-sm backdrop-blur-md md:mx-6 md:mt-6 md:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <MapPinned className="h-4 w-4" aria-hidden />
          </span>
          <span>תצוגת מפה · אילת</span>
        </div>
        <span className="hidden rounded-full border border-border/70 px-3 py-1 md:inline-flex">אזורים סטטיסטיים</span>
      </div>
      {/* Explicit height: Mapbox reads container size at init; flex %height alone can be 0×0 when lazy + grid layout settles later */}
      <div className="flex-1 p-3 md:p-4">
        <div
          dir="ltr"
          className="h-[clamp(18.25rem,44vh,33.5rem)] w-full overflow-hidden rounded-2xl border border-border bg-background md:h-[clamp(21rem,47vh,37.5rem)]"
        >
          <LeafletMap
            variant="preview"
            selectedArea={null}
            onSelectArea={noop}
            areaFilter={null}
            layerVisibility={layerVisibility}
            onToggleLayer={noop}
            filters={filters}
            onUpdateFilters={noop}
            onRunClustering={noopCluster}
            showClusters={false}
            clusterAssignments={null}
            selectedRecommendation={null}
            familyMacroClusterFocus={null}
          />
        </div>
      </div>
      <p className="shrink-0 px-6 pb-4 pt-0 text-center text-[11px] leading-5 text-muted-foreground md:text-xs">
        <Link to="/map" className="font-medium text-primary hover:underline">
          למפה המלאה
        </Link>
      </p>
    </div>
  )
}
