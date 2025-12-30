import { useMemo, useEffect, useRef } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import { useStatisticalAreas } from '../../hooks/useMapData'
import { getAreaStyle } from '../../utils/colors'
import L from 'leaflet'

function StatisticalAreasLayer({ selectedArea, onSelectArea, areaFilter }) {
  const { data, loading, error } = useStatisticalAreas()
  const map = useMap()
  const labelsRef = useRef(new Map()) // Track added labels to avoid duplicates

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
    return (feature) => {
      const stat2022 = feature.properties.stat_2022
      const isSelected = selectedArea === stat2022
      return getAreaStyle(stat2022, isSelected)
    }
  }, [selectedArea])

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
    const stat2022 = feature.properties.stat_2022
    
    // Add label at centroid (only once per area)
    if (!labelsRef.current.has(stat2022)) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const coords = feature.geometry.type === 'Polygon' 
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates[0][0]
        
        // Calculate centroid (simplified)
        let sumLat = 0
        let sumLon = 0
        let count = 0
        
        coords.forEach(coord => {
          sumLon += coord[0]
          sumLat += coord[1]
          count++
        })
        
        const centerLat = sumLat / count
        const centerLon = sumLon / count
        
        const marker = L.marker([centerLat, centerLon], {
          icon: L.divIcon({
            className: 'area-label',
            html: `<div class="area-label-text">${stat2022}</div>`,
            iconSize: [30, 20],
          }),
          interactive: false,
        })
        
        marker.addTo(map)
        labelsRef.current.set(stat2022, marker)
      }
    }
    
    // Click handler
    layer.on({
      click: () => {
        onSelectArea(stat2022)
      },
    })
    
    // Tooltip
    layer.bindTooltip(`Area ${stat2022}`, {
      permanent: false,
      direction: 'center',
    })
  }

  // Clean up labels when component unmounts or areaFilter changes
  useEffect(() => {
    return () => {
      labelsRef.current.forEach((marker) => {
        map.removeLayer(marker)
      })
      labelsRef.current.clear()
    }
  }, [map, areaFilter])

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

