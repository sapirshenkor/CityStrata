import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useMatnasim } from '../../hooks/useMapData'
import L from 'leaflet'

// Matnas icon
const matnasIcon = L.divIcon({
  className: 'custom-marker matnas-marker',
  html: '<div class="marker-icon">🏛️</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function MatnasimLayer({ filters }) {
  const { data, loading, error } = useMatnasim(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.uuid}
          position={[lat, lon]}
          icon={matnasIcon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.matnas_name}</h3>
              {properties.full_address && (
                <p><strong>Address:</strong> {properties.full_address}</p>
              )}
              {properties.person_in_charge && (
                <p><strong>Person in Charge:</strong> {properties.person_in_charge}</p>
              )}
              {properties.phone_number && (
                <p><strong>Phone:</strong> {properties.phone_number}</p>
              )}
              {properties.activity_days && (
                <p><strong>Activity Days:</strong> {properties.activity_days}</p>
              )}
              {properties.facility_area && (
                <p><strong>Facility Area:</strong> {properties.facility_area} m²</p>
              )}
              {properties.occupancy && (
                <p><strong>Occupancy:</strong> {properties.occupancy}</p>
              )}
              {properties.number_of_activity_rooms && (
                <p><strong>Activity Rooms:</strong> {properties.number_of_activity_rooms}</p>
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

export default MatnasimLayer

