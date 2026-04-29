import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { usePropertyListings } from '../../hooks/useMapData'

const apartmentIcon = L.divIcon({
  className: 'custom-marker apartment-marker',
  html: `
    <div
      style="
        width:32px;
        height:32px;
        border-radius:9999px;
        background:#2563eb;
        border:2px solid #ffffff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:16px;
        line-height:1;
      "
      title="דירות"
      aria-hidden="true"
    >
      🏢
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

const multiApartmentIcon = L.divIcon({
  className: 'custom-marker apartment-marker',
  html: `
    <div
      style="
        position:relative;
        width:32px;
        height:32px;
        border-radius:9999px;
        background:#2563eb;
        border:2px solid #ffffff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:16px;
        line-height:1;
      "
      title="דירות"
      aria-hidden="true"
    >
      🏢
      <span
        style="
          position:absolute;
          top:-5px;
          right:-7px;
          width:18px;
          height:18px;
          border-radius:9999px;
          background:#0f172a;
          color:#ffffff;
          border:1px solid #ffffff;
          font-size:11px;
          font-weight:700;
          display:flex;
          align-items:center;
          justify-content:center;
        "
      >
        +
      </span>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function formatMoney(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('he-IL').format(Number(value))
}

function ApartmentsLayer() {
  // "דירות" should show all property listings when the layer is enabled.
  const { data, loading, error } = usePropertyListings()

  const markers = useMemo(() => {
    if (!Array.isArray(data)) return []

    const byCoord = new Map()
    data
      .filter((listing) => typeof listing?.latitude === 'number' && typeof listing?.longitude === 'number')
      .forEach((listing) => {
        const key = `${listing.longitude},${listing.latitude}`
        if (!byCoord.has(key)) {
          byCoord.set(key, { lat: listing.latitude, lon: listing.longitude, listings: [] })
        }
        byCoord.get(key).listings.push(listing)
      })

    return [...byCoord.entries()].map(([key, group]) => {
      const isMulti = group.listings.length > 1
      return (
        <Marker
          key={key}
          position={[group.lat, group.lon]}
          icon={isMulti ? multiApartmentIcon : apartmentIcon}
        >
          <Popup>
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
                  <p><strong>סוג נכס:</strong> {typeLabel || '—'}</p>
                  <p><strong>כתובת:</strong> {address || '—'}</p>
                  <p><strong>יחידות:</strong> {units.length}</p>
                  <p><strong>מחיר חודשי:</strong> {formatMoney(firstPriced?.monthly_price)}</p>
                  <p><strong>טלפון:</strong> {listing.phone_number || '—'}</p>
                </div>
              )
            })}
          </Popup>
        </Marker>
      )
    })
  }, [data])

  if (loading || error) return null
  return <>{markers}</>
}

export default ApartmentsLayer
