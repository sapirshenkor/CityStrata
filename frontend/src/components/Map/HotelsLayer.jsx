import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useHotels } from '../../hooks/useMapData'
import { formatRating } from '../../utils/formatters'
import L from 'leaflet'

// Hotel icon
const hotelIcon = L.divIcon({
  className: 'custom-marker hotel-marker',
  html: '<div class="marker-icon">🏨</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function HotelsLayer({ filters }) {
  const { data, loading, error } = useHotels(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.uuid}
          position={[lat, lon]}
          icon={hotelIcon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.name}</h3>
              {properties.type && (
                <p><strong>Type:</strong> {properties.type}</p>
              )}
              {properties.rating_value && (
                <p><strong>Rating:</strong> {formatRating(properties.rating_value)}</p>
              )}
              {properties.location_fulladdress && (
                <p><strong>Address:</strong> {properties.location_fulladdress}</p>
              )}
              {properties.url && (
                <p><a href={properties.url} target="_blank" rel="noopener noreferrer">View Details</a></p>
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

export default HotelsLayer

