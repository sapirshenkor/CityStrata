import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useAirbnbListings } from '../../hooks/useMapData'
import { formatCurrency, formatRating } from '../../utils/formatters'
import L from 'leaflet'

// Home icon
const homeIcon = L.divIcon({
  className: 'custom-marker airbnb-marker',
  html: '<div class="marker-icon">🏠</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function AirbnbLayer({ filters }) {
  const { data, loading, error } = useAirbnbListings(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.uuid}
          position={[lat, lon]}
          icon={homeIcon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.title}</h3>
              {properties.price_per_night && (
                <p><strong>Price:</strong> {formatCurrency(properties.price_per_night)}/night</p>
              )}
              {properties.person_capacity && (
                <p><strong>Capacity:</strong> {properties.person_capacity} people</p>
              )}
              {properties.rating_value && (
                <p><strong>Rating:</strong> {formatRating(properties.rating_value)}</p>
              )}
              {properties.url && (
                <p><a href={properties.url} target="_blank" rel="noopener noreferrer">View Listing</a></p>
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

export default AirbnbLayer

