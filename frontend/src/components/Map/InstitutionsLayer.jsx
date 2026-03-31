import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { useInstitutions } from '../../hooks/useMapData'
import L from 'leaflet'

const schoolIcon = L.divIcon({
  className: 'custom-marker institution-marker',
  html: '<div class="marker-icon">🏫</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

// Icon variant that signals multiple institutions share this point.
const multiSchoolIcon = L.divIcon({
  className: 'custom-marker institution-marker',
  html: '<div class="marker-icon" style="position:relative">🏫<span style="position:absolute;top:-4px;right:-6px;background:#667eea;color:#fff;border-radius:50%;font-size:10px;font-weight:700;width:16px;height:16px;display:flex;align-items:center;justify-content:center;line-height:1">+</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function InstitutionsLayer({ filters }) {
  const { data, loading, error } = useInstitutions(filters)

  const markers = useMemo(() => {
    if (!data?.features) return []

    // Group all institution rows by their exact coordinate string so that
    // co-located institutions (same building, different programmes) are
    // surfaced in one popup rather than stacked invisibly behind each other.
    const byCoord = new Map()
    data.features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates
      const key = `${lon},${lat}`
      if (!byCoord.has(key)) byCoord.set(key, { lat, lon, institutions: [] })
      byCoord.get(key).institutions.push(feature.properties)
    })

    return [...byCoord.entries()].map(([key, { lat, lon, institutions }]) => {
      const isMulti = institutions.length > 1
      return (
        <Marker
          key={key}
          position={[lat, lon]}
          icon={isMulti ? multiSchoolIcon : schoolIcon}
        >
          <Popup>
            {institutions.map((p, idx) => (
              <div
                key={p.id}
                className="popup-content"
                style={idx > 0 ? { borderTop: '1px solid #e0e0e0', paddingTop: 8, marginTop: 8 } : undefined}
              >
                <h3 style={{ margin: '0 0 4px' }}>{p.institution_name}</h3>
                <p style={{ margin: '2px 0' }}><strong>Code:</strong> {p.institution_code}</p>
                {p.address && <p style={{ margin: '2px 0' }}><strong>Address:</strong> {p.address}</p>}
                {p.education_phase && <p style={{ margin: '2px 0' }}><strong>Phase:</strong> {p.education_phase}</p>}
                {p.type_of_education && <p style={{ margin: '2px 0' }}><strong>Type:</strong> {p.type_of_education}</p>}
                {p.type_of_supervision && <p style={{ margin: '2px 0' }}><strong>Supervision:</strong> {p.type_of_supervision}</p>}
                <p style={{ margin: '2px 0' }}><strong>Area:</strong> {p.stat_2022}</p>
              </div>
            ))}
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

