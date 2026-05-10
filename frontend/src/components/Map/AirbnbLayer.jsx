import { memo, useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { useAirbnbListings } from '../../hooks/useMapData'
import { formatCurrency, formatRating } from '../../utils/formatters'
import { isPointInsideRecommendationRadii } from '../../utils/recommendationZones'

function AirbnbLayer({ filters, recommendation }) {
  const { data, loading, error } = useAirbnbListings(filters)
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
              <div className="custom-marker airbnb-marker">
                <div className="marker-icon">🏠</div>
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
                  <h3>{properties.title}</h3>
                  {properties.price_per_night && (
                    <p>
                      <strong>מחיר:</strong> {formatCurrency(properties.price_per_night)} ללילה
                    </p>
                  )}
                  {properties.person_capacity && (
                    <p>
                      <strong>קיבולת:</strong> {properties.person_capacity} נפשות
                    </p>
                  )}
                  {properties.rating_value && (
                    <p>
                      <strong>דירוג:</strong> {formatRating(properties.rating_value)}
                    </p>
                  )}
                  {properties.url && (
                    <p>
                      <a href={properties.url} target="_blank" rel="noopener noreferrer">
                        צפייה בנכס
                      </a>
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

export default memo(AirbnbLayer)
