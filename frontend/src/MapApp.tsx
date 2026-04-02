import { useState } from 'react'
import LeafletMap from './components/Map/LeafletMap'
import { AppHeader } from './components/layout/AppHeader'
import { MapSidebar, type LayerVisibility } from './components/Sidebar/MapSidebar'
import UserBar from './components/UserBar'
import { useClusterAssignments } from './hooks/useMapData'

const defaultLayerVisibility: LayerVisibility = {
  statisticalAreas: true,
  institutions: false,
  airbnb: false,
  restaurants: false,
  coffeeShops: false,
  hotels: false,
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
  matnasim: {},
  osmFacilities: {},
  synagogues: {},
}

export default function MapApp() {
  const [selectedArea, setSelectedArea] = useState<number | null>(null)
  const [selectedRecommendation, setSelectedRecommendation] = useState<unknown>(null)
  const { data: clusterAssignments, refetch: refetchClusterAssignments } = useClusterAssignments()
  const [layerVisibility, setLayerVisibility] =
    useState<LayerVisibility>(defaultLayerVisibility)
  const [filters, setFilters] = useState<Record<string, unknown>>(defaultFilters)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f8f9fa]">
      <AppHeader>
        <UserBar />
      </AppHeader>

      <div className="flex min-h-0 flex-1">
        <MapSidebar
          selectedRecommendation={selectedRecommendation}
          onSelectRecommendation={setSelectedRecommendation}
          layerVisibility={layerVisibility}
          onToggleLayer={setLayerVisibility}
          filters={filters}
          onUpdateFilters={setFilters}
          clusterAssignments={clusterAssignments ?? null}
          onRunClustering={() => refetchClusterAssignments()}
          selectedArea={selectedArea}
          onSelectArea={setSelectedArea}
        />

        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="map-shell h-full w-full p-3">
            <div className="h-full w-full overflow-hidden rounded-lg border border-[#e0e0e0] bg-white shadow-md">
              <LeafletMap
                selectedArea={selectedArea}
                onSelectArea={setSelectedArea}
                areaFilter={null}
                layerVisibility={layerVisibility}
                filters={filters}
                showClusters={layerVisibility.clusters}
                clusterAssignments={clusterAssignments}
                selectedRecommendation={selectedRecommendation}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
