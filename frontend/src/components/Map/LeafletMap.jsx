/**
 * Map chrome uses Mapbox GL (react-map-gl). Layer overlays are temporarily disabled pending migration off react-leaflet.
 */
import { useEffect, useRef, useState } from 'react'
import Map, { NavigationControl, FullscreenControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MapLayersPanel } from './MapLayersPanel'
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
import ClusterMacroFit from './ClusterMacroFit'
// import LayerControls from './LayerControls'

const EILAT_CENTER = [29.55, 34.95]
const DEFAULT_ZOOM = 13
const BUILDINGS_3D_LAYER_ID = 'mapbox-3d-buildings'
/** Min zoom for building extrusions and for clamping the camera when entering 3D. */
const BUILDINGS_3D_MIN_ZOOM = 15

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

function getFirstLabelLayerId(map) {
  const layers = map.getStyle()?.layers ?? []
  const labelLayer = layers.find(
    (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field'],
  )
  return labelLayer?.id
}

function ensure3DBuildingsLayer(map) {
  if (!map.getLayer(BUILDINGS_3D_LAYER_ID)) {
    map.addLayer(
      {
        id: BUILDINGS_3D_LAYER_ID,
        type: 'fill-extrusion',
        source: 'composite',
        'source-layer': 'building',
        minzoom: BUILDINGS_3D_MIN_ZOOM,
        paint: {
          'fill-extrusion-color': '#aaa',
          // Fallback height ensures visible extrusion even when `height` is missing.
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 18],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.7,
        },
      },
      getFirstLabelLayerId(map),
    )
  }
}

/** @typedef {'full' | 'preview'} MapVariant */

export default function LeafletMap({
  selectedArea,
  onSelectArea,
  areaFilter,
  layerVisibility,
  onToggleLayer,
  filters,
  onUpdateFilters,
  onRunClustering,
  showClusters,
  clusterAssignments,
  selectedRecommendation,
  familyMacroClusterFocus,
  /** @type {MapVariant | undefined} */
  variant = 'full',
}) {
  const isPreview = variant === 'preview'
  const [layersMenuOpen, setLayersMenuOpen] = useState(false)
  const [is3D, setIs3D] = useState(false)
  /** Desktop / fine pointer: allow drag-pan; avoid scroll vs. map fights on touch & narrow viewports. */
  const [previewDragPan, setPreviewDragPan] = useState(true)
  const mapRef = useRef(null)
  const previewResizeObserverRef = useRef(null)

  useEffect(() => {
    return () => {
      previewResizeObserverRef.current?.disconnect()
      previewResizeObserverRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isPreview) return
    const update = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const wide = window.matchMedia('(min-width: 768px)').matches
      setPreviewDragPan(wide && !coarse)
    }
    update()
    const mqCoarse = window.matchMedia('(pointer: coarse)')
    const mqWide = window.matchMedia('(min-width: 768px)')
    mqCoarse.addEventListener('change', update)
    mqWide.addEventListener('change', update)
    return () => {
      mqCoarse.removeEventListener('change', update)
      mqWide.removeEventListener('change', update)
    }
  }, [isPreview])

  const airbnbFilters = { ...filters.airbnb, ...(areaFilter && { area: areaFilter }) }
  const hotelsFilters = { ...filters.hotels, ...(areaFilter && { area: areaFilter }) }
  const restaurantsFilters = { ...filters.restaurants, ...(areaFilter && { area: areaFilter }) }
  const coffeeShopsFilters = { ...filters.coffeeShops, ...(areaFilter && { area: areaFilter }) }
  const institutionsFilters = { ...filters.institutions, ...(areaFilter && { area: areaFilter }) }
  const matnasimFilters = { ...filters.matnasim, ...(areaFilter && { area: areaFilter }) }
  const synagoguesFilters = { ...filters.synagogues, ...(areaFilter && { area: areaFilter }) }
  const osmFacilitiesFilters = { ...filters.osmFacilities, ...(areaFilter && { area: areaFilter }) }

  const queriedLayerIds = isPreview
    ? []
    : [
        ...(layerVisibility.statisticalAreas ? [STATISTICAL_AREAS_FILL_LAYER_ID] : []),
        ...(selectedRecommendation?.radii_data?.length ? [RECOMMENDATIONS_FILL_LAYER_ID] : []),
      ]
  const interactiveLayerIds = isPreview ? [] : queriedLayerIds.length ? queriedLayerIds : undefined
  const onMapLoad = (event) => {
    const map = event.target
    mapRef.current = map
    ensure3DBuildingsLayer(map)
    map.setLayoutProperty(BUILDINGS_3D_LAYER_ID, 'visibility', 'none')

    const bumpResize = () => {
      try {
        map.resize()
      } catch {
        /* ignore */
      }
    }
    bumpResize()
    requestAnimationFrame(bumpResize)
    requestAnimationFrame(() => requestAnimationFrame(bumpResize))

    if (isPreview && typeof ResizeObserver !== 'undefined') {
      previewResizeObserverRef.current?.disconnect()
      const container = map.getContainer?.()
      if (container) {
        const ro = new ResizeObserver(() => bumpResize())
        ro.observe(container)
        previewResizeObserverRef.current = ro
      }
    }
  }

  const toggle2D3D = () => {
    const map = mapRef.current
    if (!map?.easeTo) return

    if (is3D) {
      if (map.getLayer(BUILDINGS_3D_LAYER_ID)) {
        map.setLayoutProperty(BUILDINGS_3D_LAYER_ID, 'visibility', 'none')
      }
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
      setIs3D(false)
      return
    }

    ensure3DBuildingsLayer(map)
    map.setLayoutProperty(BUILDINGS_3D_LAYER_ID, 'visibility', 'visible')
    const zoom = map.getZoom()
    const easeTo3D = { pitch: 60, bearing: 20, duration: 700 }
    if (zoom < BUILDINGS_3D_MIN_ZOOM) {
      easeTo3D.zoom = BUILDINGS_3D_MIN_ZOOM
    }
    map.easeTo(easeTo3D)
    setIs3D(true)
  }

  return (
    <Map
      ref={mapRef}
      onLoad={onMapLoad}
      mapboxAccessToken={mapboxToken}
      mapStyle={mapStyle}
      initialViewState={{
        latitude: EILAT_CENTER[0],
        longitude: EILAT_CENTER[1],
        zoom: DEFAULT_ZOOM,
        pitch: 0,
        bearing: 0,
      }}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={interactiveLayerIds}
      scrollZoom={!isPreview}
      dragPan={isPreview ? previewDragPan : true}
      doubleClickZoom={!isPreview}
    >
      {!isPreview && (
        <>
          <NavigationControl position="top-right" />
          <FullscreenControl />
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-h-[calc(100%-24px)] flex-col">
            <button
              type="button"
              className="pointer-events-auto w-fit rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow"
              onClick={() => setLayersMenuOpen((prev) => !prev)}
            >
              שכבות
            </button>
            <button
              type="button"
              className="pointer-events-auto mt-2 w-fit rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow"
              onClick={toggle2D3D}
            >
              {is3D ? '2D' : '3D'}
            </button>
            {layersMenuOpen && (
              <div className="pointer-events-auto mt-2 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur">
                <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
                  <MapLayersPanel
                    layerVisibility={layerVisibility}
                    onToggleLayer={onToggleLayer}
                    filters={filters}
                    onUpdateFilters={onUpdateFilters}
                    clusterAssignments={clusterAssignments ?? null}
                    onRunClustering={onRunClustering}
                    selectedArea={selectedArea}
                    onSelectArea={onSelectArea}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {layerVisibility.statisticalAreas && (
        <StatisticalAreasLayer
          selectedArea={selectedArea}
          onSelectArea={onSelectArea}
          areaFilter={areaFilter}
          showClusters={showClusters}
          clusterAssignments={clusterAssignments}
        />
      )}

      <ClusterMacroFit
        macroClusterIndex={familyMacroClusterFocus}
        clusterAssignments={clusterAssignments ?? undefined}
        selectedRecommendation={selectedRecommendation}
      />

      <RecommendationsLayer recommendation={selectedRecommendation} />

      {layerVisibility.airbnb && (
        <AirbnbLayer filters={airbnbFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.hotels && (
        <HotelsLayer filters={hotelsFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.apartments && <ApartmentsLayer recommendation={selectedRecommendation} />}
      {layerVisibility.restaurants && (
        <RestaurantsLayer filters={restaurantsFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.coffeeShops && (
        <CoffeeShopsLayer filters={coffeeShopsFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.institutions && (
        <InstitutionsLayer filters={institutionsFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.matnasim && (
        <MatnasimLayer filters={matnasimFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.synagogues && (
        <SynagoguesLayer filters={synagoguesFilters} recommendation={selectedRecommendation} />
      )}
      {layerVisibility.osmFacilities && (
        <OSMFacilitiesLayer filters={osmFacilitiesFilters} recommendation={selectedRecommendation} />
      )}
    </Map>
  )
}
