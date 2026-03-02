import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useSynagogues } from '../../hooks/useMapData'
import L from 'leaflet'

// Synagogue icon
const synagogueIcon = L.divIcon({
  className: 'custom-marker synagogue-marker',
  html: '<div class="marker-icon">🕍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function SynagoguesLayer({ filters }) {
  const { data, loading, error } = useSynagogues(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.uuid}
          position={[lat, lon]}
          icon={synagogueIcon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.name}</h3>
              {properties.name_he && (
                <p><strong>שם:</strong> {properties.name_he}</p>
              )}
              {properties.type && (
                <p><strong>Type:</strong> {properties.type}</p>
              )}
              {properties.type_he && (
                <p><strong>סוג:</strong> {properties.type_he}</p>
              )}
              {properties.address && (
                <p><strong>Address:</strong> {properties.address}</p>
              )}
              <p><strong>Area:</strong> {properties.stat_2022}</p>
            </div>
          </Popup>
        </Marker>
      )
    })
  }, [data])

  if (loading) return null
  if (error) return null

  return <>{markers}</>
}

export default SynagoguesLayer
