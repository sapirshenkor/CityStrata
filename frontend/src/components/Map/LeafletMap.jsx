/**
 * Map chrome uses Mapbox GL (react-map-gl). Layer overlays are temporarily disabled pending migration off react-leaflet.
 */
import Map, { NavigationControl, FullscreenControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import StatisticalAreasLayer, {
  STATISTICAL_AREAS_FILL_LAYER_ID,
} from './StatisticalAreasLayer'
import AirbnbLayer from './AirbnbLayer'
import HotelsLayer from './HotelsLayer'
import ApartmentsLayer from './ApartmentsLayer'
import RestaurantsLayer from './RestaurantsLayer'
import CoffeeShopsLayer from './CoffeeShopsLayer'
import InstitutionsLayer from './InstitutionsLayer'
import MatnasimLayer from './MatnasimLayer'
import SynagoguesLayer from './SynagoguesLayer'
import OSMFacilitiesLayer from './OSMFacilitiesLayer'
import RecommendationsLayer, { RECOMMENDATIONS_FILL_LAYER_ID } from './RecommendationsLayer'
// import LayerControls from './LayerControls'

const EILAT_CENTER = [29.55, 34.95]
const DEFAULT_ZOOM = 13

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? ''
const mapboxAccountUsername = import.meta.env.VITE_MAPBOX_USERNAME ?? ''
const rawStyleId = import.meta.env.VITE_MAPBOX_STYLE_ID?.trim() || 'streets-v12'

/** Public Mapbox templates use style owner `mapbox`; Studio styles use your username + style id. */
const MAPBOX_PUBLIC_STYLE_IDS = new Set([
  'dark-v11',
  'light-v11',
  'streets-v11',
  'streets-v12',
  'outdoors-v11',
  'outdoors-v12',
  'satellite-v9',
  'satellite-streets-v12',
  'navigation-day-v1',
  'navigation-night-v1',
])

const rasterStyleUsername =
  mapboxAccountUsername && rawStyleId && !MAPBOX_PUBLIC_STYLE_IDS.has(rawStyleId)
    ? mapboxAccountUsername
    : 'mapbox'

const mapStyle = `mapbox://styles/${rasterStyleUsername}/${rawStyleId}`

export default function LeafletMap({
  selectedArea,
  onSelectArea,
  areaFilter,
  layerVisibility,
  filters,
  showClusters,
  clusterAssignments,
  selectedRecommendation,
}) {
  const airbnbFilters = { ...filters.airbnb, ...(areaFilter && { area: areaFilter }) }
  const hotelsFilters = { ...filters.hotels, ...(areaFilter && { area: areaFilter }) }
  const restaurantsFilters = { ...filters.restaurants, ...(areaFilter && { area: areaFilter }) }
  const coffeeShopsFilters = { ...filters.coffeeShops, ...(areaFilter && { area: areaFilter }) }
  const institutionsFilters = { ...filters.institutions, ...(areaFilter && { area: areaFilter }) }
  const matnasimFilters = { ...filters.matnasim, ...(areaFilter && { area: areaFilter }) }
  const synagoguesFilters = { ...filters.synagogues, ...(areaFilter && { area: areaFilter }) }
  const osmFacilitiesFilters = { ...filters.osmFacilities, ...(areaFilter && { area: areaFilter }) }

  const queriedLayerIds = [
    ...(layerVisibility.statisticalAreas ? [STATISTICAL_AREAS_FILL_LAYER_ID] : []),
    ...(selectedRecommendation?.radii_data?.length ? [RECOMMENDATIONS_FILL_LAYER_ID] : []),
  ]
  const interactiveLayerIds = queriedLayerIds.length ? queriedLayerIds : undefined

  return (
    <Map
      mapboxAccessToken={mapboxToken}
      mapStyle={mapStyle}
      initialViewState={{
        latitude: EILAT_CENTER[0],
        longitude: EILAT_CENTER[1],
        zoom: DEFAULT_ZOOM,
      }}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={interactiveLayerIds}
    >
      <NavigationControl position="top-right" />
      <FullscreenControl />

      {layerVisibility.statisticalAreas && (
        <StatisticalAreasLayer
          selectedArea={selectedArea}
          onSelectArea={onSelectArea}
          areaFilter={areaFilter}
          showClusters={showClusters}
          clusterAssignments={clusterAssignments}
        />
      )}

      <RecommendationsLayer recommendation={selectedRecommendation} />

      {layerVisibility.airbnb && <AirbnbLayer filters={airbnbFilters} />}
      {layerVisibility.hotels && <HotelsLayer filters={hotelsFilters} />}
      {layerVisibility.apartments && <ApartmentsLayer />}
      {layerVisibility.restaurants && <RestaurantsLayer filters={restaurantsFilters} />}
      {layerVisibility.coffeeShops && <CoffeeShopsLayer filters={coffeeShopsFilters} />}
      {layerVisibility.institutions && <InstitutionsLayer filters={institutionsFilters} />}
      {layerVisibility.matnasim && <MatnasimLayer filters={matnasimFilters} />}
      {layerVisibility.synagogues && <SynagoguesLayer filters={synagoguesFilters} />}
      {layerVisibility.osmFacilities && <OSMFacilitiesLayer filters={osmFacilitiesFilters} />}
    </Map>
  )
}
