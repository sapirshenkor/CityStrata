import { memo, useEffect, useMemo, useState } from 'react'
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

function ApartmentsLayer({ recommendation, focusedApartment }) {
  const { data, loading, error } = usePropertyListings()
  const [activeKey, setActiveKey] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

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

  useEffect(() => {
    if (!focusedApartment) return
    const { latitude, longitude, id } = focusedApartment
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return

    const key = `${longitude},${latitude}`
    const group = grouped.find(([k]) => k === key)?.[1]
    if (!group) return

    setActiveKey(key)

    if (id) {
      const idx = group.listings.findIndex((l) => {
        const lId = l?.id ?? l?.uuid ?? l?.listing_id ?? l?.created_at
        return String(lId ?? '') === String(id)
      })
      setActiveIndex(idx >= 0 ? idx : 0)
    } else {
      setActiveIndex(0)
    }
  }, [focusedApartment, grouped])

  if (loading || error) return null

  const visibleGroups = useMemo(() => {
    if (!focusedApartment) return grouped
    const { latitude, longitude } = focusedApartment
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return grouped
    const key = `${longitude},${latitude}`
    const match = grouped.find(([k]) => k === key)
    return match ? [match] : []
  }, [focusedApartment, grouped])

  return (
    <>
      {visibleGroups.map(([key, group]) => {
        const isMulti = group.listings.length > 1
        const isOpen = activeKey === key

        const clampedIndex =
          group.listings.length > 0
            ? Math.min(Math.max(activeIndex, 0), group.listings.length - 1)
            : 0
        const currentListing = group.listings[clampedIndex] ?? null

        return (
          <div key={key}>
            <Marker
              longitude={group.lon}
              latitude={group.lat}
              anchor="bottom"
              onClick={() => {
                setActiveKey(key)
                setActiveIndex(0)
              }}
            >
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
                {currentListing ? (
                  <div className="popup-content">
                    {group.listings.length > 1 ? (
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
                          {clampedIndex + 1} / {group.listings.length}
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/30 text-sm text-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => setActiveIndex((idx) => Math.min(group.listings.length - 1, idx + 1))}
                          disabled={clampedIndex === group.listings.length - 1}
                          aria-label="הבא"
                        >
                          ›
                        </button>
                      </div>
                    ) : null}

                    {(() => {
                      const units = Array.isArray(currentListing.units) ? currentListing.units : []
                      const firstPriced = units.find((u) => u?.monthly_price != null)
                      const typeLabel =
                        currentListing.property_type === 'other' && currentListing.property_type_other
                          ? currentListing.property_type_other
                          : currentListing.property_type
                      const address = [
                        currentListing.city,
                        currentListing.street,
                        currentListing.house_number,
                        currentListing.neighborhood,
                      ]
                        .filter(Boolean)
                        .join(', ')

                      return (
                        <>
                          <h3>{currentListing.publisher_name || 'דירה'}</h3>
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
                            <strong>טלפון:</strong> {currentListing.phone_number || '—'}
                          </p>
                        </>
                      )
                    })()}
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

export default memo(ApartmentsLayer)
