import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { useSynagogues } from '../../hooks/useMapData'
import { isPointInsideRecommendationRadii } from '../../utils/recommendationZones'

function SynagoguesLayer({ filters, recommendation }) {
  const { data, loading, error } = useSynagogues(filters)
  const [activeUuid, setActiveUuid] = useState(null)

  const features = useMemo(() => {
    if (!data?.features) return []
    return data.features.filter((feature) => {
      const [lon, lat] = feature.geometry.coordinates
      return isPointInsideRecommendationRadii(lat, lon, recommendation)
    })
  }, [data, recommendation])

  if (loading || error) return null

  return (
    <>
      {features.map((feature) => {
        const { geometry, properties } = feature
        const [lon, lat] = geometry.coordinates
        const isOpen = activeUuid === properties.uuid

        return (
          <div key={properties.uuid}>
            <Marker longitude={lon} latitude={lat} anchor="bottom" onClick={() => setActiveUuid(properties.uuid)}>
              <div className="custom-marker synagogue-marker">
                <div className="marker-icon">🕍</div>
              </div>
            </Marker>
            {isOpen && (
              <Popup
                longitude={lon}
                latitude={lat}
                anchor="bottom"
                offset={12}
                closeButton
                closeOnClick={false}
                maxWidth="280px"
                onClose={() => setActiveUuid(null)}
              >
                <div className="popup-content">
                  <h3>{properties.name}</h3>
                  {properties.name_he && (
                    <p>
                      <strong>שם:</strong> {properties.name_he}
                    </p>
                  )}
                  {properties.type && (
                    <p>
                      <strong>סוג:</strong> {properties.type}
                    </p>
                  )}
                  {properties.type_he && (
                    <p>
                      <strong>סוג:</strong> {properties.type_he}
                    </p>
                  )}
                  {properties.address && (
                    <p>
                      <strong>כתובת:</strong> {properties.address}
                    </p>
                  )}
                  <p>
                    <strong>אזור:</strong> {properties.stat_2022}
                  </p>
                </div>
              </Popup>
            )}
          </div>
        )
      })}
    </>
  )
}

export default SynagoguesLayer
