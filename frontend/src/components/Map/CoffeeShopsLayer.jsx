import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useCoffeeShops } from '../../hooks/useMapData'
import { formatRating } from '../../utils/formatters'
import L from 'leaflet'

// Coffee icon
const coffeeIcon = L.divIcon({
  className: 'custom-marker coffee-marker',
  html: '<div class="marker-icon">☕</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function CoffeeShopsLayer({ filters }) {
  const { data, loading, error } = useCoffeeShops(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.uuid}
          position={[lat, lon]}
          icon={coffeeIcon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.title}</h3>
              {properties.category_name && (
                <p><strong>Category:</strong> {properties.category_name}</p>
              )}
              {properties.total_score && (
                <p><strong>Score:</strong> {formatRating(properties.total_score)}</p>
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

export default CoffeeShopsLayer

