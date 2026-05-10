import { memo, useMemo, useState } from 'react'
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
  const [activeIndex, setActiveIndex] = useState(0)

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

        const clampedIndex =
          institutions.length > 0
            ? Math.min(Math.max(activeIndex, 0), institutions.length - 1)
            : 0
        const currentInstitution = institutions[clampedIndex]

        return (
          <div key={key}>
            <Marker
              longitude={lon}
              latitude={lat}
              anchor="bottom"
              onClick={() => {
                setActiveKey(key)
                setActiveIndex(0)
              }}
            >
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
                {currentInstitution ? (
                  <div className="popup-content">
                    {institutions.length > 1 ? (
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/30 text-sm text-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => setActiveIndex((idx) => Math.max(0, idx - 1))}
                          disabled={clampedIndex === 0}
                          aria-label="הקודם"
                        >
                          ‹
                        </button>
                        <div className="text-xs text-muted-foreground" aria-live="polite">
                          {clampedIndex + 1} / {institutions.length}
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/30 text-sm text-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => setActiveIndex((idx) => Math.min(institutions.length - 1, idx + 1))}
                          disabled={clampedIndex === institutions.length - 1}
                          aria-label="הבא"
                        >
                          ›
                        </button>
                      </div>
                    ) : null}

                    <h3 style={{ margin: '0 0 4px' }}>{currentInstitution.institution_name}</h3>
                    <p style={{ margin: '2px 0' }}>
                      <strong>קוד:</strong> {currentInstitution.institution_code}
                    </p>
                    {currentInstitution.address && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>כתובת:</strong> {currentInstitution.address}
                      </p>
                    )}
                    {currentInstitution.education_phase && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>שלב חינוך:</strong> {currentInstitution.education_phase}
                      </p>
                    )}
                    {currentInstitution.type_of_education && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>סוג חינוך:</strong> {currentInstitution.type_of_education}
                      </p>
                    )}
                    {currentInstitution.type_of_supervision && (
                      <p style={{ margin: '2px 0' }}>
                        <strong>פיקוח:</strong> {currentInstitution.type_of_supervision}
                      </p>
                    )}
                    <p style={{ margin: '2px 0' }}>
                      <strong>אזור:</strong> {currentInstitution.stat_2022}
                    </p>
                  </div>
                ) : null}
              </Popup>
            )}
          </div>
        )
      })}
    </>
  )
}

export default memo(InstitutionsLayer)
