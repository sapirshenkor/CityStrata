import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { useOSMFacilities } from '../../hooks/useMapData'

const FACILITY_ICON_MAP = {
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

function getFacilityEmoji(facilityType) {
  const typeLower = facilityType?.toLowerCase() || ''
  for (const [key, emoji] of Object.entries(FACILITY_ICON_MAP)) {
    if (key === 'default') continue
    if (typeLower.includes(key) || key.includes(typeLower)) {
      return emoji
    }
  }
  return FACILITY_ICON_MAP.default
}

function OSMFacilitiesLayer({ filters }) {
  const { data, loading, error } = useOSMFacilities(filters)
  const [activeUuid, setActiveUuid] = useState(null)

  const features = useMemo(() => (data?.features ? data.features : []), [data])

  if (loading || error) return null

  return (
    <>
      {features.map((feature) => {
        const { geometry, properties } = feature
        const [lon, lat] = geometry.coordinates
        const emoji = getFacilityEmoji(properties.facility_type)
        const isOpen = activeUuid === properties.uuid

        return (
          <div key={properties.uuid}>
            <Marker longitude={lon} latitude={lat} anchor="bottom" onClick={() => setActiveUuid(properties.uuid)}>
              <div className="custom-marker osm-facility-marker">
                <div className="marker-icon">{emoji}</div>
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
                  <h3>{properties.name || 'מתקן ללא שם'}</h3>
                  <p>
                    <strong>סוג:</strong> {properties.facility_type}
                  </p>
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

export default OSMFacilitiesLayer
