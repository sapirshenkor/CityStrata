import { useState } from 'react'
import LeafletMap from './components/Map/LeafletMap'
import Sidebar from './components/Sidebar/Sidebar'
import UserBar from './components/UserBar'
import { useClusterAssignments } from './hooks/useMapData'
import './App.css'

/** Main map + sidebar (public). */
export default function MapApp() {
  const [selectedArea, setSelectedArea] = useState(null)
  const { data: clusterAssignments, refetch: refetchClusterAssignments } = useClusterAssignments()
  const [layerVisibility, setLayerVisibility] = useState({
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
  })
  const [filters, setFilters] = useState({
    institutions: {},
    airbnb: {},
    restaurants: {},
    coffeeShops: {},
    hotels: {},
    matnasim: {},
    osmFacilities: {},
    synagogues: {},
  })

  return (
    <div className="app">
      <UserBar />
      <Sidebar
        selectedArea={selectedArea}
        onSelectArea={setSelectedArea}
        layerVisibility={layerVisibility}
        onToggleLayer={setLayerVisibility}
        filters={filters}
        onUpdateFilters={setFilters}
        clusterAssignments={clusterAssignments}
        onRunClustering={refetchClusterAssignments}
      />
      <div className="map-container">
        <LeafletMap
          selectedArea={selectedArea}
          onSelectArea={setSelectedArea}
          areaFilter={null}
          layerVisibility={layerVisibility}
          filters={filters}
          showClusters={layerVisibility.clusters}
          clusterAssignments={clusterAssignments}
        />
      </div>
    </div>
  )
}
