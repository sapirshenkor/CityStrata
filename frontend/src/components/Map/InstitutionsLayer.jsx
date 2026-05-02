import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { useInstitutions } from '../../hooks/useMapData'
import { isPointInsideRecommendationRadii } from '../../utils/recommendationZones'

function InstitutionMarkerBubble({ multi }) {
  return (
    <div className="custom-marker institution-marker" style={{ position: 'relative', width: 30, height: 30 }}>
      <div className="marker-icon" style={{ position: 'relative' }}>
        🏫
        {multi && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              background: '#2563eb',
              color: '#fff',
              borderRadius: '50%',
              fontSize: 10,
              fontWeight: 700,
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            +
          </span>
        )}
      </div>
    </div>
  )
}

function InstitutionsLayer({ filters, recommendation }) {
  const { data, loading, error } = useInstitutions(filters)
  const [activeKey, setActiveKey] = useState(null)

  const grouped = useMemo(() => {
    if (!data?.features?.length) return []

    const byCoord = new Map()
    data.features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates
      if (!isPointInsideRecommendationRadii(lat, lon, recommendation)) return
      const key = `${lon},${lat}`
      if (!byCoord.has(key)) byCoord.set(key, { lat, lon, institutions: [] })
      byCoord.get(key).institutions.push(feature.properties)
    })

    return [...byCoord.entries()]
  }, [data, recommendation])

  if (loading || error) return null

  return (
    <>
      {grouped.map(([key, { lat, lon, institutions }]) => {
        const isMulti = institutions.length > 1
        const isOpen = activeKey === key

        return (
          <div key={key}>
            <Marker longitude={lon} latitude={lat} anchor="bottom" onClick={() => setActiveKey(key)}>
              <InstitutionMarkerBubble multi={isMulti} />
            </Marker>
            {isOpen && (
              <Popup
                longitude={lon}
                latitude={lat}
                anchor="bottom"
                offset={12}
                closeButton
                closeOnClick={false}
                maxWidth="320px"
                onClose={() => setActiveKey(null)}
              >
                {institutions.map((p, idx) => (
                  <div
                    key={p.id}
                    className="popup-content"
                    style={idx > 0 ? { borderTop: '1px solid #e0e0e0', paddingTop: 8, marginTop: 8 } : undefined}
                  >
                    <h3 style={{ margin: '0 0 4px' }}>{p.institution_name}</h3>
                    <p style={{ margin: '2px 0' }}>
                      <strong>קוד:</strong> {p.institution_code}
                    </p>
                    {p.address && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>כתובת:</strong> {p.address}
                      </p>
                    )}
                    {p.education_phase && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>שלב חינוך:</strong> {p.education_phase}
                      </p>
                    )}
                    {p.type_of_education && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>סוג חינוך:</strong> {p.type_of_education}
                      </p>
                    )}
                    {p.type_of_supervision && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>פיקוח:</strong> {p.type_of_supervision}
                      </p>
                    )}
                    <p style={{ margin: '2px 0' }}>
                      <strong>אזור:</strong> {p.stat_2022}
                    </p>
                  </div>
                ))}
              </Popup>
            )}
          </div>
        )
      })}
    </>
  )
}

export default InstitutionsLayer
