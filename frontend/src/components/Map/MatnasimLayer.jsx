import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { useMatnasim } from '../../hooks/useMapData'

function MatnasimLayer({ filters }) {
  const { data, loading, error } = useMatnasim(filters)
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
              <div className="custom-marker matnas-marker">
                <div className="marker-icon">🏛️</div>
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
                maxWidth="300px"
                onClose={() => setActiveUuid(null)}
              >
                <div className="popup-content">
                  <h3>{properties.matnas_name}</h3>
                  {properties.full_address && (
                    <p>
                      <strong>כתובת:</strong> {properties.full_address}
                    </p>
                  )}
                  {properties.person_in_charge && (
                    <p>
                      <strong>איש קשר:</strong> {properties.person_in_charge}
                    </p>
                  )}
                  {properties.phone_number && (
                    <p>
                      <strong>טלפון:</strong> {properties.phone_number}
                    </p>
                  )}
                  {properties.activity_days && (
                    <p>
                      <strong>ימי פעילות:</strong> {properties.activity_days}
                    </p>
                  )}
                  {properties.facility_area && (
                    <p>
                      <strong>שטח מתקן:</strong> {properties.facility_area} מ&quot;ר
                    </p>
                  )}
                  {properties.occupancy && (
                    <p>
                      <strong>תפוסה:</strong> {properties.occupancy}
                    </p>
                  )}
                  {properties.number_of_activity_rooms && (
                    <p>
                      <strong>חדרי פעילות:</strong> {properties.number_of_activity_rooms}
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

export default MatnasimLayer
