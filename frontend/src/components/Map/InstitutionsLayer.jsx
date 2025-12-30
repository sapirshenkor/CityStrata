import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useInstitutions } from '../../hooks/useMapData'
import L from 'leaflet'

// School icon
const schoolIcon = L.divIcon({
  className: 'custom-marker institution-marker',
  html: '<div class="marker-icon">🏫</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function InstitutionsLayer({ filters }) {
  const { data, loading, error } = useInstitutions(filters)

  const markers = useMemo(() => {
    if (!data || !data.features) return []
    
    return data.features.map((feature) => {
      const { geometry, properties } = feature
      const [lon, lat] = geometry.coordinates
      
      return (
        <Marker
          key={properties.id}
          position={[lat, lon]}
          icon={schoolIcon}
        >
          <Popup>
            <div className="popup-content">
              <h3>{properties.institution_name}</h3>
              <p><strong>Code:</strong> {properties.institution_code}</p>
              {properties.address && <p><strong>Address:</strong> {properties.address}</p>}
              {properties.education_phase && <p><strong>Phase:</strong> {properties.education_phase}</p>}
              {properties.type_of_education && <p><strong>Type:</strong> {properties.type_of_education}</p>}
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

export default InstitutionsLayer

