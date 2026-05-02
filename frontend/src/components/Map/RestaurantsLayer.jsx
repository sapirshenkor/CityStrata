import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { useRestaurants } from '../../hooks/useMapData'
import { formatRating } from '../../utils/formatters'

function RestaurantsLayer({ filters }) {
  const { data, loading, error } = useRestaurants(filters)
  const [activeUuid, setActiveUuid] = useState(null)

  const features = useMemo(() => (data?.features ? data.features : []), [data])

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
              <div className="custom-marker restaurant-marker">
                <div className="marker-icon">🍴</div>
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
                  {properties.category_name && (
                    <p>
                      <strong>קטגוריה:</strong> {properties.category_name}
                    </p>
                  )}
                  {properties.total_score && (
                    <p>
                      <strong>ציון:</strong> {formatRating(properties.total_score)}
                    </p>
                  )}
                  {properties.url && (
                    <p>
                      <a href={properties.url} target="_blank" rel="noopener noreferrer">
                        צפייה בפרטים
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

export default RestaurantsLayer
