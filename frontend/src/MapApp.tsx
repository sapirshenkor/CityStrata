import { useCallback, useEffect, useState } from 'react'
import LeafletMap from './components/Map/LeafletMap'
import { AppHeader } from './components/layout/AppHeader'
import { MapSidebar } from './components/Sidebar/MapSidebar'
import type { LayerVisibility } from './components/Map/MapLayersPanel'
import UserBar from './components/UserBar'
import { useClusterAssignments } from './hooks/useMapData'
import { ThinkingState } from './components/Map/ThinkingState'
import type { FocusedListing, LodgingsMapScope } from './components/Sidebar/PublicListingsPanel'
import { RadiusLodgingsSidebar } from './components/Sidebar/RadiusLodgingsSidebar'

const defaultLayerVisibility: LayerVisibility = {
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

const defaultFilters: Record<string, unknown> = {
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

export default function MapApp() {
  const [selectedArea, setSelectedArea] = useState<number | null>(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState<unknown>(null)
  const [familyMacroClusterFocus, setFamilyMacroClusterFocus] = useState<number | null>(null)
  const [recommendationsAgentProcessing, setRecommendationsAgentProcessing] = useState(false)
  const [focusLocation, setFocusLocation] = useState<{ latitude: number; longitude: number; zoom?: number } | null>(
    null,
  )
  const [focusedListing, setFocusedListing] = useState<FocusedListing | null>(null)
  const { data: clusterAssignments, refetch: refetchClusterAssignments } = useClusterAssignments()
  const [layerVisibility, setLayerVisibility] =
    useState<LayerVisibility>(defaultLayerVisibility)
  const [filters, setFilters] = useState<Record<string, unknown>>(defaultFilters)
  const [radiusLodgingsOpen, setRadiusLodgingsOpen] = useState(false)
  const [focusedRadiusPriorityIndex, setFocusedRadiusPriorityIndex] = useState<number>(0)
  const [lodgingsMapScope, setLodgingsMapScope] = useState<LodgingsMapScope>('radius')

  const onRunClustering = useCallback(() => {
    void refetchClusterAssignments()
  }, [refetchClusterAssignments])

  const handleFocusLocation = useCallback((focused: FocusedListing) => {
    setFocusLocation({ latitude: focused.latitude, longitude: focused.longitude, zoom: 16 })
    setFocusedListing(focused)

    const layerKey =
      focused.kind === 'apartments' ? 'apartments' : focused.kind === 'hotels' ? 'hotels' : 'airbnb'

    setLodgingsMapScope(layerKey)

    setLayerVisibility((prev) => ({
      ...prev,
      airbnb: layerKey === 'airbnb',
      hotels: layerKey === 'hotels',
      apartments: layerKey === 'apartments',
      [layerKey]: true,
    }))
  }, [])

  const handleLodgingsMapScope = useCallback((scope: LodgingsMapScope) => {
    setFocusedListing(null)
    setFocusLocation(null)
    setLodgingsMapScope(scope)

    if (scope === 'radius') {
      setLayerVisibility((prev) => ({
        ...prev,
        airbnb: true,
        hotels: true,
        apartments: true,
      }))
      return
    }

    setLayerVisibility((prev) => ({
      ...prev,
      airbnb: scope === 'airbnb',
      hotels: scope === 'hotels',
      apartments: scope === 'apartments',
    }))
  }, [])

  const handleToggleLayer = useCallback((next: LayerVisibility) => {
    setLayerVisibility((prev) => {
      const lodgingChanged =
        next.airbnb !== prev.airbnb || next.hotels !== prev.hotels || next.apartments !== prev.apartments

      if (lodgingChanged) {
        setFocusedListing(null)
        setFocusLocation(null)
        const lodgingOnCount = Number(next.airbnb) + Number(next.hotels) + Number(next.apartments)
        if (lodgingOnCount >= 2) {
          setLodgingsMapScope('radius')
        } else if (next.apartments) {
          setLodgingsMapScope('apartments')
        } else if (next.hotels) {
          setLodgingsMapScope('hotels')
        } else if (next.airbnb) {
          setLodgingsMapScope('airbnb')
        } else {
          setLodgingsMapScope('radius')
        }
      }

      return next
    })
  }, [])

  useEffect(() => {
    const hasRadii = (selectedRecommendation as { radii_data?: unknown[] } | null)?.radii_data?.length
    setRadiusLodgingsOpen(Boolean(hasRadii))
    if (hasRadii) {
      setFocusedRadiusPriorityIndex(0)
      setLodgingsMapScope('radius')
      setFocusedListing(null)
      setFocusLocation(null)
    }
  }, [selectedRecommendation])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader variant="map">
        <UserBar />
      </AppHeader>

      <div className="flex min-h-0 flex-1">
        <MapSidebar
          selectedRecommendation={selectedRecommendation}
          onSelectRecommendation={setSelectedRecommendation}
          onFamilyMacroClusterFocus={setFamilyMacroClusterFocus}
          onRecommendationsProcessingChange={setRecommendationsAgentProcessing}
          onFocusLocation={handleFocusLocation}
          agentThinkingOverlay={
            recommendationsAgentProcessing ? <ThinkingState variant="sidebar" /> : undefined
          }
        />

        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="map-shell h-full w-full p-3">
            <div className="h-full w-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm shadow-black/20">
              <div dir="ltr" className="h-full w-full min-h-0">
                <LeafletMap
                  selectedArea={selectedArea}
                  onSelectArea={setSelectedArea}
                  areaFilter={null}
                  layerVisibility={layerVisibility}
                  onToggleLayer={handleToggleLayer}
                  filters={filters}
                  onUpdateFilters={setFilters}
                  onRunClustering={onRunClustering}
                  showClusters={layerVisibility.clusters}
                  clusterAssignments={clusterAssignments}
                  selectedRecommendation={selectedRecommendation}
                  familyMacroClusterFocus={familyMacroClusterFocus}
                  focusLocation={focusLocation}
                  focusedListing={focusedListing}
                  lodgingsMapScope={lodgingsMapScope}
                  onLodgingsMapScope={handleLodgingsMapScope}
                  focusedRadiusPriorityIndex={focusedRadiusPriorityIndex}
                  onFocusedRadiusPriorityIndexChange={setFocusedRadiusPriorityIndex}
                  onLodgingMarkerFocus={handleFocusLocation}
                />
              </div>
            </div>
          </div>

          {(selectedRecommendation as { radii_data?: unknown[] } | null)?.radii_data?.length &&
          radiusLodgingsOpen ? (
            <div className="pointer-events-none absolute inset-y-6 right-6 z-40 flex w-[min(360px,40vw)]">
              <div className="pointer-events-auto h-full w-full overflow-hidden">
                <RadiusLodgingsSidebar
                  recommendation={selectedRecommendation}
                  onClose={() => setRadiusLodgingsOpen(false)}
                  onFocusLocation={handleFocusLocation}
                  focusedRadiusPriorityIndex={focusedRadiusPriorityIndex}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
