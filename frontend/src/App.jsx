import { useState } from 'react'
import LeafletMap from './components/Map/LeafletMap'
import Sidebar from './components/Sidebar/Sidebar'
import './App.css'

function App() {
  const [selectedArea, setSelectedArea] = useState(null)
  const [areaFilter, setAreaFilter] = useState(null) // Filter to show only one area
  const [layerVisibility, setLayerVisibility] = useState({
    statisticalAreas: true,
    institutions: false,
    airbnb: false,
    restaurants: false,
    coffeeShops: false,
    hotels: false,
    matnasim: false,
    osmFacilities: false,
  })
  const [filters, setFilters] = useState({
    institutions: {},
    airbnb: {},
    restaurants: {},
    coffeeShops: {},
    hotels: {},
    matnasim: {},
    osmFacilities: {},
  })

  return (
    <div className="app">
      <Sidebar
        selectedArea={selectedArea}
        onSelectArea={setSelectedArea}
        areaFilter={areaFilter}
        onAreaFilterChange={setAreaFilter}
        layerVisibility={layerVisibility}
        onToggleLayer={setLayerVisibility}
        filters={filters}
        onUpdateFilters={setFilters}
      />
      <div className="map-container">
        <LeafletMap
          selectedArea={selectedArea}
          onSelectArea={setSelectedArea}
          areaFilter={areaFilter}
          layerVisibility={layerVisibility}
          filters={filters}
        />
      </div>
    </div>
  )
}

export default App

