import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useOSMFacilities } from '../../hooks/useMapData'
import L from 'leaflet'

// Map facility types to emoji icons
const getFacilityIcon = (facilityType) => {
  const iconMap = {
    school: '🏫',
    park: '🌳',
    pharmacy: '💊',
    hospital: '🏥',
    clinic: '🏥',
    restaurant: '🍽️',
    cafe: '☕',
    bank: '🏦',
    atm: '💳',
    supermarket: '🛒',
    shop: '🏪',
    library: '📚',
    museum: '🏛️',
    theater: '🎭',
    cinema: '🎬',
    gym: '💪',
    swimming_pool: '🏊',
    beach: '🏖️',
    hotel: '🏨',
    bus_station: '🚌',
    parking: '🅿️',
    police: '👮',
    fire_station: '🚒',
    post_office: '📮',
    church: '⛪',
    mosque: '🕌',
    synagogue: '🕍',
    default: '📍',
  }

  // Try to find a match (case-insensitive, partial match)
  const typeLower = facilityType?.toLowerCase() || ''
  for (const [key, emoji] of Object.entries(iconMap)) {
    if (typeLower.includes(key) || key.includes(typeLower)) {
      return emoji
    }
  }
  return iconMap.default
}

// Create icon for a facility type
const createFacilityIcon = (facilityType) => {
  const emoji = getFacilityIcon(facilityType)
  return L.divIcon({
    className: 'custom-marker osm-facility-marker',
    html: `<div class="marker-icon">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  })
}

function OSMFacilitiesLayer({ filters }) {
  const { data, loading, error } = useOSMFacilities(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.uuid}
          position={[lat, lon]}
          icon={createFacilityIcon(properties.facility_type)}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.name || 'Unnamed Facility'}</h3>
              <p><strong>Type:</strong> {properties.facility_type}</p>
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

export default OSMFacilitiesLayer

