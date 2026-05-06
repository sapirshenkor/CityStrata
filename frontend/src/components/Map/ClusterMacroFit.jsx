import { useEffect } from 'react'
import { useMap } from 'react-map-gl/mapbox'
import { useStatisticalAreas } from '../../hooks/useMapData'
import { geojsonBBoxLngLat, mergeLngLatBounds } from '../../utils/geoBounds'

/**
 * When a family's macro-cluster is selected (e.g. Commercial Core → cluster index),
 * fit the map to the union of statistical areas assigned to that cluster.
 * Tactical recommendation radii (when present) take precedence — RecommendationsLayer handles those.
 */
export default function ClusterMacroFit({ macroClusterIndex, clusterAssignments, selectedRecommendation }) {
  const mapRef = useMap()?.current
  const { data: statGeo, loading, error } = useStatisticalAreas()

  useEffect(() => {
    const hasRadii = selectedRecommendation?.radii_data?.length > 0
    const skip =
      macroClusterIndex == null ||
      Number.isNaN(Number(macroClusterIndex)) ||
      !Array.isArray(clusterAssignments) ||
      clusterAssignments.length === 0 ||
      hasRadii ||
      loading ||
      error ||
      !statGeo?.features?.length ||
      !mapRef?.fitBounds

    if (skip) return

    const target = Number(macroClusterIndex)
    const statSet = new Set(
      clusterAssignments
        .filter((a) => Number(a.cluster) === target)
        .map((a) => Number(a.stat_2022))
        .filter((n) => !Number.isNaN(n)),
    )

    if (statSet.size === 0) return

    const matchingFeatures = statGeo.features.filter((f) =>
      statSet.has(Number(f.properties?.stat_2022)),
    )
    const boxes = matchingFeatures.map((f) => geojsonBBoxLngLat(f.geometry)).filter(Boolean)
    const bounds = mergeLngLatBounds(boxes)
    if (!bounds) return

    let cancelled = false
    const applyFit = () => {
      if (cancelled) return
      mapRef.fitBounds(bounds, {
        padding: { top: 56, bottom: 56, left: 56, right: 56 },
        maxZoom: 14,
        duration: 700,
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
  }, [mapRef, macroClusterIndex, clusterAssignments, statGeo, loading, error, selectedRecommendation])

  return null
}
