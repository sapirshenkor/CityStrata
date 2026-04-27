import { useMemo, useEffect } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import { useStatisticalAreas } from '../../hooks/useMapData'
import { getAreaStyle, getClusterStyle } from '../../utils/colors'

function StatisticalAreasLayer({ selectedArea, onSelectArea, areaFilter, showClusters, clusterAssignments }) {
  const { data, loading, error } = useStatisticalAreas()
  const map = useMap()

  const statToCluster = useMemo(() => {
    if (!clusterAssignments || !Array.isArray(clusterAssignments)) return null
    const m = new Map()
    clusterAssignments.forEach((a) => {
      const key = Number(a.stat_2022)
      if (!Number.isNaN(key)) {
        m.set(key, a.cluster)
      }
    })
    return m
  }, [clusterAssignments])

  // Filter data by areaFilter if set
  const filteredData = useMemo(() => {
    if (!data || !data.features) return null
    if (!areaFilter) return data
    
    return {
      ...data,
      features: data.features.filter(
        (feature) => feature.properties.stat_2022 === areaFilter
      ),
    }
  }, [data, areaFilter])

  const style = useMemo(() => {
    const byCluster = showClusters && statToCluster
    return (feature) => {
      const stat2022 = Number(feature.properties.stat_2022)
      const isSelected = selectedArea === stat2022
      if (byCluster) {
        const cluster = statToCluster.get(stat2022)
        if (cluster !== undefined) return getClusterStyle(cluster, isSelected)
      }
      return getAreaStyle(stat2022, isSelected)
    }
  }, [selectedArea, showClusters, statToCluster])

  // Zoom to filtered area when areaFilter changes
  useEffect(() => {
    if (areaFilter && filteredData && filteredData.features && filteredData.features.length > 0) {
      const feature = filteredData.features[0]
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const coords = feature.geometry.type === 'Polygon' 
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates[0][0]
        
        // Calculate bounds - GeoJSON is [lon, lat], Leaflet needs [lat, lon]
        const bounds = coords.reduce((acc, coord) => {
          const lat = coord[1]
          const lon = coord[0]
          return [
            [Math.min(acc[0][0], lat), Math.min(acc[0][1], lon)],
            [Math.max(acc[1][0], lat), Math.max(acc[1][1], lon)]
          ]
        }, [[90, 180], [-90, -180]])
        
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      }
    }
  }, [areaFilter, filteredData, map])

  const onEachFeature = (feature, layer) => {
    const stat2022 = Number(feature.properties.stat_2022)

    // Click handler
    layer.on({
      click: () => {
        onSelectArea(stat2022)
      },
    })
    
    // Tooltip
    const cluster = statToCluster?.get(stat2022)
    const assignment = clusterAssignments?.find((a) => a.stat_2022 === stat2022)
    const clusterName =
      assignment?.cluster_name ??
      assignment?.cluster_label ??
      (cluster !== undefined ? `אשכול ${cluster}` : null)
    const tooltipText =
      showClusters && cluster !== undefined && clusterName
        ? clusterName
        : `אזור ${stat2022}`

    layer.bindTooltip(tooltipText, {
      permanent: false,
      direction: 'center',
    })
  }

  if (loading) return null
  if (error) return null
  if (!filteredData || !filteredData.features) return null

  return (
    <GeoJSON
      data={filteredData}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}

export default StatisticalAreasLayer

