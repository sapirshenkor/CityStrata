import { MapContainer, TileLayer } from 'react-leaflet'
import { useEffect } from 'react'
import StatisticalAreasLayer from './StatisticalAreasLayer'
import InstitutionsLayer from './InstitutionsLayer'
import AirbnbLayer from './AirbnbLayer'
import RestaurantsLayer from './RestaurantsLayer'
import CoffeeShopsLayer from './CoffeeShopsLayer'
import HotelsLayer from './HotelsLayer'
import MatnasimLayer from './MatnasimLayer'
import OSMFacilitiesLayer from './OSMFacilitiesLayer'
import LayerControls from './LayerControls'
import 'leaflet/dist/leaflet.css'

// Fix for default markers in react-leaflet
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

const EILAT_CENTER = [29.55, 34.95]
const DEFAULT_ZOOM = 13

function LeafletMap({ selectedArea, onSelectArea, areaFilter, layerVisibility, filters }) {
  // Merge areaFilter into filters for all layers
  const institutionsFilters = { ...filters.institutions, ...(areaFilter && { area: areaFilter }) }
  const airbnbFilters = { ...filters.airbnb, ...(areaFilter && { area: areaFilter }) }
  const restaurantsFilters = { ...filters.restaurants, ...(areaFilter && { area: areaFilter }) }
  const coffeeShopsFilters = { ...filters.coffeeShops, ...(areaFilter && { area: areaFilter }) }
  const hotelsFilters = { ...filters.hotels, ...(areaFilter && { area: areaFilter }) }
  const matnasimFilters = { ...filters.matnasim, ...(areaFilter && { area: areaFilter }) }
  const osmFacilitiesFilters = { ...filters.osmFacilities, ...(areaFilter && { area: areaFilter }) }

  return (
    <MapContainer
      center={EILAT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {layerVisibility.statisticalAreas && (
        <StatisticalAreasLayer
          selectedArea={selectedArea}
          onSelectArea={onSelectArea}
          areaFilter={areaFilter}
        />
      )}

      {layerVisibility.institutions && (
        <InstitutionsLayer filters={institutionsFilters} />
      )}

      {layerVisibility.airbnb && (
        <AirbnbLayer filters={airbnbFilters} />
      )}

      {layerVisibility.restaurants && (
        <RestaurantsLayer filters={restaurantsFilters} />
      )}

      {layerVisibility.coffeeShops && (
        <CoffeeShopsLayer filters={coffeeShopsFilters} />
      )}

      {layerVisibility.hotels && (
        <HotelsLayer filters={hotelsFilters} />
      )}

      {layerVisibility.matnasim && (
        <MatnasimLayer filters={matnasimFilters} />
      )}

      {layerVisibility.osmFacilities && (
        <OSMFacilitiesLayer filters={osmFacilitiesFilters} />
      )}

      <LayerControls />
    </MapContainer>
  )
}

export default LeafletMap

