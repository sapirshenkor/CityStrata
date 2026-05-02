import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { usePropertyListings } from '../../hooks/useMapData'
import { isPointInsideRecommendationRadii } from '../../utils/recommendationZones'

function formatMoney(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('he-IL').format(Number(value))
}

function ApartmentMarkerBubble({ multi }) {
  return (
    <div className="custom-marker apartment-marker" style={{ position: 'relative', width: 32, height: 32 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9999,
          background: '#2563eb',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
        }}
        title="דירות"
        aria-hidden
      >
        🏢
        {multi && (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -7,
              width: 18,
              height: 18,
              borderRadius: 9999,
              background: '#0f172a',
              color: '#ffffff',
              border: '1px solid #ffffff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </span>
        )}
      </div>
    </div>
  )
}

function ApartmentsLayer({ recommendation }) {
  const { data, loading, error } = usePropertyListings()
  const [activeKey, setActiveKey] = useState(null)

  const grouped = useMemo(() => {
    if (!Array.isArray(data)) return []

    const byCoord = new Map()
    data
      .filter((listing) => typeof listing?.latitude === 'number' && typeof listing?.longitude === 'number')
      .filter((listing) =>
        isPointInsideRecommendationRadii(listing.latitude, listing.longitude, recommendation),
      )
      .forEach((listing) => {
        const key = `${listing.longitude},${listing.latitude}`
        if (!byCoord.has(key)) {
          byCoord.set(key, { lat: listing.latitude, lon: listing.longitude, listings: [] })
        }
        byCoord.get(key).listings.push(listing)
      })

    return [...byCoord.entries()]
  }, [data, recommendation])

  if (loading || error) return null

  return (
    <>
      {grouped.map(([key, group]) => {
        const isMulti = group.listings.length > 1
        const isOpen = activeKey === key

        return (
          <div key={key}>
            <Marker longitude={group.lon} latitude={group.lat} anchor="bottom" onClick={() => setActiveKey(key)}>
              <ApartmentMarkerBubble multi={isMulti} />
            </Marker>
            {isOpen && (
              <Popup
                longitude={group.lon}
                latitude={group.lat}
                anchor="bottom"
                offset={12}
                closeButton
                closeOnClick={false}
                maxWidth="300px"
                onClose={() => setActiveKey(null)}
              >
                {group.listings.map((listing, idx) => {
                  const units = Array.isArray(listing.units) ? listing.units : []
                  const firstPriced = units.find((u) => u?.monthly_price != null)
                  const typeLabel =
                    listing.property_type === 'other' && listing.property_type_other
                      ? listing.property_type_other
                      : listing.property_type
                  const address = [listing.city, listing.street, listing.house_number, listing.neighborhood]
                    .filter(Boolean)
                    .join(', ')

                  return (
                    <div
                      key={listing.id}
                      className="popup-content"
                      style={idx > 0 ? { borderTop: '1px solid #e0e0e0', paddingTop: 8, marginTop: 8 } : undefined}
                    >
                      <h3>{listing.publisher_name || 'דירה'}</h3>
                      <p>
                        <strong>סוג נכס:</strong> {typeLabel || '—'}
                      </p>
                      <p>
                        <strong>כתובת:</strong> {address || '—'}
                      </p>
                      <p>
                        <strong>יחידות:</strong> {units.length}
                      </p>
                      <p>
                        <strong>מחיר חודשי:</strong> {formatMoney(firstPriced?.monthly_price)}
                      </p>
                      <p>
                        <strong>טלפון:</strong> {listing.phone_number || '—'}
                      </p>
                    </div>
                  )
                })}
              </Popup>
            )}
          </div>
        )
      })}
    </>
  )
}

export default ApartmentsLayer
