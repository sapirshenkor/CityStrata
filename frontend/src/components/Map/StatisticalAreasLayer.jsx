import { useMemo, useEffect } from 'react'
import { Source, Layer, useMap } from 'react-map-gl/mapbox'
import { useStatisticalAreas } from '../../hooks/useMapData'
import { CLUSTER_COLORS, layerColors, STATISTICAL_AREA_FILL_PALETTE } from '../../utils/colors'

/** Source id — use when wiring Map `interactiveLayerIds` / query features from the parent */
export const STATISTICAL_AREAS_SOURCE_ID = 'statistical-areas'

/** Parent `Map` handlers can inspect `features` where `layer.id === STATISTICAL_AREAS_FILL_LAYER_ID` */
export const STATISTICAL_AREAS_FILL_LAYER_ID = 'statistical-areas-fill'

/** Outline layer id for polygons from the same source */
export const STATISTICAL_AREAS_LINE_LAYER_ID = 'statistical-areas-outline'

const MISSING_CLUSTER = -1
const PALETTE_LENGTH = STATISTICAL_AREA_FILL_PALETTE.length

/**
 * Bounds as [[minLng, minLat], [maxLng, maxLat]] — Mapbox `fitBounds` (GeoJSON [lon, lat] order).
 */
function geojsonBBoxLngLat(geometry) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  function walkRing(ring) {
    for (const coord of ring) {
      const [lng, lat] = coord
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
  }

  if (geometry.type === 'Polygon') walkRing(geometry.coordinates[0])
  else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) walkRing(polygon[0])
  } else return null

  return Number.isFinite(minLng)
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null
}

function buildStatModuloColorExpression() {
  const statExpr = ['to-number', ['get', 'stat_2022']]
  const modIndex = ['%', ['-', statExpr, 1], PALETTE_LENGTH]
  const expr = ['match', modIndex]
  STATISTICAL_AREA_FILL_PALETTE.forEach((hex, idx) => {
    expr.push(idx, hex)
  })
  expr.push(STATISTICAL_AREA_FILL_PALETTE[0])
  return expr
}

function buildUnselectedFillColorExpression(useClusterRamp) {
  const moduloExpr = buildStatModuloColorExpression()

  if (!useClusterRamp) return moduloExpr

  const clusterMatch = ['match', ['to-number', ['get', 'area_cluster']]]
  CLUSTER_COLORS.forEach((hex, idx) => {
    clusterMatch.push(idx, hex)
  })
  clusterMatch.push('#888888')

  return [
    'case',
    ['==', ['to-number', ['get', 'area_cluster']], MISSING_CLUSTER],
    moduloExpr,
    clusterMatch,
  ]
}

function buildFillColorExpression(selectedArea, useClusterRamp) {
  const selectedHex = layerColors.statisticalAreas.selected
  const rest = buildUnselectedFillColorExpression(useClusterRamp)
  if (selectedArea === null || selectedArea === undefined) return rest
  return ['case', ['==', ['to-number', ['get', 'stat_2022']], selectedArea], selectedHex, rest]
}

function buildFillOpacityExpression(selectedArea, useClusterRamp) {
  if (!useClusterRamp) {
    if (selectedArea === null || selectedArea === undefined) return 0.46
    return [
      'case',
      ['==', ['to-number', ['get', 'stat_2022']], selectedArea],
      0.58,
      0.46,
    ]
  }

  if (selectedArea === null || selectedArea === undefined) {
    return [
      'case',
      ['==', ['to-number', ['get', 'area_cluster']], MISSING_CLUSTER],
      0.46,
      0.52,
    ]
  }

  return [
    'case',
    ['==', ['to-number', ['get', 'stat_2022']], selectedArea],
    0.62,
    ['==', ['to-number', ['get', 'area_cluster']], MISSING_CLUSTER],
    0.46,
    0.52,
  ]
}

function buildLineWidthExpression(selectedArea) {
  if (selectedArea === null || selectedArea === undefined) return 2.5
  return ['case', ['==', ['to-number', ['get', 'stat_2022']], selectedArea], 4, 2.5]
}

function StatisticalAreasLayer({ selectedArea, onSelectArea, areaFilter, showClusters, clusterAssignments }) {
  const { data, loading, error } = useStatisticalAreas()
  const mapRef = useMap()?.current

  const statToCluster = useMemo(() => {
    if (!clusterAssignments || !Array.isArray(clusterAssignments)) return null
    const m = new Map()
    clusterAssignments.forEach((a) => {
      const key = Number(a.stat_2022)
      if (!Number.isNaN(key)) m.set(key, Number(a.cluster))
    })
    return m
  }, [clusterAssignments])

  const filteredData = useMemo(() => {
    if (!data || !data.features) return null
    if (!areaFilter) return data
    return {
      ...data,
      features: data.features.filter((feature) => feature.properties.stat_2022 === areaFilter),
    }
  }, [data, areaFilter])

  /** Mapbox paints need cluster index on features when using cluster styling */
  const geoJsonWithClusterProp = useMemo(() => {
    if (!filteredData?.features?.length) return filteredData
    const useCluster = !!(showClusters && statToCluster)
    if (!useCluster) return filteredData

    return {
      ...filteredData,
      features: filteredData.features.map((f) => {
        const stat = Number(f.properties.stat_2022)
        const raw = Number.isFinite(stat) ? statToCluster?.get(stat) : undefined
        const ci =
          raw !== undefined && !Number.isNaN(Number(raw))
            ? ((Math.trunc(Number(raw)) % CLUSTER_COLORS.length) + CLUSTER_COLORS.length) %
              CLUSTER_COLORS.length
            : MISSING_CLUSTER
        return {
          ...f,
          properties: {
            ...f.properties,
            area_cluster: ci,
          },
        }
      }),
    }
  }, [filteredData, showClusters, statToCluster])

  const useClusterRamp = !!(showClusters && statToCluster)

  const fillPaint = useMemo(
    () => ({
      'fill-color': buildFillColorExpression(selectedArea, useClusterRamp),
      'fill-opacity': buildFillOpacityExpression(selectedArea, useClusterRamp),
    }),
    [selectedArea, useClusterRamp],
  )

  const linePaint = useMemo(
    () => ({
      'line-color': layerColors.statisticalAreas.stroke,
      'line-width': buildLineWidthExpression(selectedArea),
      'line-opacity': 1,
    }),
    [selectedArea],
  )

  /** Fit viewport when filtering to a single area — Mapbox expects SW/NE lng/lat, not Leaflet LatLngBounds */
  useEffect(() => {
    const skip =
      areaFilter === null ||
      areaFilter === undefined ||
      !geoJsonWithClusterProp?.features?.length ||
      !mapRef?.fitBounds
    if (skip) return

    const feature = geoJsonWithClusterProp.features[0]
    if (!feature.geometry) return

    const bounds = geojsonBBoxLngLat(feature.geometry)
    if (!bounds) return

    let cancelled = false
    const applyFit = () => {
      if (cancelled) return
      mapRef.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
      })
    }

    const mb = typeof mapRef.getMap === 'function' ? mapRef.getMap() : null
    const styleLoaded =
      typeof mapRef.isStyleLoaded === 'function'
        ? mapRef.isStyleLoaded()
        : (mb?.isStyleLoaded?.() ?? false)

    if (styleLoaded) applyFit()
    else if (mb?.once) mb.once('load', applyFit)
    else applyFit()

    return () => {
      cancelled = true
      mb?.off?.('load', applyFit)
    }
  }, [areaFilter, geoJsonWithClusterProp, mapRef])

  /** Clicks forwarded from Mapbox onto this layer until the parent wires `interactiveLayerIds` + `onClick` */
  useEffect(() => {
    const mb =
      typeof mapRef?.getMap === 'function' ? mapRef.getMap() : null
    if (!mb?.on) return undefined

    const onFillClick = (e) => {
      const f = e.features?.[0]
      if (!f?.properties) return
      onSelectArea(Number(f.properties.stat_2022))
    }

    mb.on('click', STATISTICAL_AREAS_FILL_LAYER_ID, onFillClick)
    mb.on('click', STATISTICAL_AREAS_LINE_LAYER_ID, onFillClick)

    return () => {
      mb.off('click', STATISTICAL_AREAS_FILL_LAYER_ID, onFillClick)
      mb.off('click', STATISTICAL_AREAS_LINE_LAYER_ID, onFillClick)
    }
  }, [mapRef, onSelectArea])

  if (loading || error || !geoJsonWithClusterProp?.features?.length) return null

  return (
    <Source id={STATISTICAL_AREAS_SOURCE_ID} type="geojson" data={geoJsonWithClusterProp}>
      <Layer id={STATISTICAL_AREAS_FILL_LAYER_ID} type="fill" paint={fillPaint} />
      <Layer id={STATISTICAL_AREAS_LINE_LAYER_ID} type="line" paint={linePaint} />
    </Source>
  )
}

export default StatisticalAreasLayer
