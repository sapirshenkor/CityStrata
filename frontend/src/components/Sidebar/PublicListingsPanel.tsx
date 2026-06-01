import { useMemo, useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAirbnbListings, useHotels, usePropertyListings } from '@/hooks/useMapData'
import { Input } from '@/components/ui/input'
import {
  isPointInsideRecommendationRadii,
  isPointInsideZone,
  orderRadiiByLlmNarrative,
} from '@/utils/recommendationZones'

export type MapFocusLocation = {
  latitude: number
  longitude: number
  zoom?: number
}

export type FocusedListing =
  | { kind: 'apartments'; latitude: number; longitude: number; id?: string | null }
  | { kind: 'hotels'; latitude: number; longitude: number; uuid?: string | null }
  | { kind: 'airbnb'; latitude: number; longitude: number; uuid?: string | null }

export type LodgingsMapScope = 'radius' | 'apartments' | 'hotels' | 'airbnb'

type NumberRange = { min: number | null; max: number | null }

function formatMoney(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('he-IL').format(n)
}

function safeString(value: unknown) {
  if (value == null) return ''
  return String(value).trim()
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {label}
    </a>
  )
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail ?? 'אין נתונים להצגה כרגע.'}</p>
      </CardContent>
    </Card>
  )
}

function LoadingBlock({ title }: { title: string }) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </CardContent>
    </Card>
  )
}

function ErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <Card className="rounded-2xl border-border/80 bg-card shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-destructive">שגיאה: {message}</p>
      </CardContent>
    </Card>
  )
}

function tryParseNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function matchesSearch(parts: string[], query: string) {
  const q = normalizeQuery(query)
  if (!q) return true
  const hay = parts.filter(Boolean).join(' ').toLowerCase()
  return hay.includes(q)
}

function inRange(value: number | null, range: NumberRange) {
  if (value == null) return false
  if (range.min != null && value < range.min) return false
  if (range.max != null && value > range.max) return false
  return true
}

function parseNullableNumber(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function ClickableCard({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : undefined}
    >
      {children}
    </div>
  )
}

export function PublicListingsPanel({
  onFocusLocation,
  recommendation,
  headerTitle,
  headerSubtitle,
  visibleTabs,
  defaultTab,
  focusedRadiusPriorityIndex,
}: {
  onFocusLocation?: (focused: FocusedListing) => void
  recommendation?: unknown
  headerTitle?: string
  headerSubtitle?: string
  visibleTabs?: Array<'apartments' | 'hotels' | 'airbnb'>
  defaultTab?: 'apartments' | 'hotels' | 'airbnb'
  /** When set, filters points to priority index (0-based) or -1 for All. Applies only when `recommendation` is set. */
  focusedRadiusPriorityIndex?: number
}) {
  const apartmentsQuery = usePropertyListings()
  const hotelsQuery = useHotels()
  const airbnbQuery = useAirbnbListings()

  const [searchQuery, setSearchQuery] = useState('')

  const [apartmentMonthlyPrice, setApartmentMonthlyPrice] = useState<NumberRange>({
    min: null,
    max: null,
  })
  const [apartmentType, setApartmentType] = useState<string>('all')

  const [hotelType, setHotelType] = useState<string>('all')
  const [hotelRatingMin, setHotelRatingMin] = useState<number | null>(null)

  const [airbnbNightPrice, setAirbnbNightPrice] = useState<NumberRange>({ min: null, max: null })
  const [airbnbCapacityMin, setAirbnbCapacityMin] = useState<number | null>(null)
  const [airbnbRatingMin, setAirbnbRatingMin] = useState<number | null>(null)

  const apartments = useMemo(() => {
    if (!Array.isArray(apartmentsQuery.data)) return []
    const all = apartmentsQuery.data as Array<Record<string, unknown>>
    if (!recommendation) return all

    const rec = recommendation as { radii_data?: unknown[]; agent_output?: unknown }
    const radiiRaw = Array.isArray(rec.radii_data) ? rec.radii_data : []
    const ordered = orderRadiiByLlmNarrative(String(rec.agent_output ?? ''), radiiRaw)
    const idx = typeof focusedRadiusPriorityIndex === 'number' ? focusedRadiusPriorityIndex : -1
    const zones = idx === -1 ? ordered : ordered[idx] ? [ordered[idx]] : []

    return all.filter((listing) => {
      const lat = tryParseNumber(listing.latitude)
      const lon = tryParseNumber(listing.longitude)
      if (lat == null || lon == null) return false
      if (zones.length === 0) return false
      if (idx === -1) return isPointInsideRecommendationRadii(lat, lon, recommendation)
      return isPointInsideZone(lat, lon, zones[0])
    })
  }, [apartmentsQuery.data, focusedRadiusPriorityIndex, recommendation])

  const hotels = useMemo(() => {
    const fc = hotelsQuery.data as { features?: unknown[] } | null
    if (!fc?.features || !Array.isArray(fc.features)) return []
    const all = fc.features as Array<{ geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }>
    if (!recommendation) return all

    const rec = recommendation as { radii_data?: unknown[]; agent_output?: unknown }
    const radiiRaw = Array.isArray(rec.radii_data) ? rec.radii_data : []
    const ordered = orderRadiiByLlmNarrative(String(rec.agent_output ?? ''), radiiRaw)
    const idx = typeof focusedRadiusPriorityIndex === 'number' ? focusedRadiusPriorityIndex : -1
    const zones = idx === -1 ? ordered : ordered[idx] ? [ordered[idx]] : []

    return all.filter((feature) => {
      const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : null
      const lon = coords ? tryParseNumber(coords[0]) : null
      const lat = coords ? tryParseNumber(coords[1]) : null
      if (lat == null || lon == null) return false
      if (zones.length === 0) return false
      if (idx === -1) return isPointInsideRecommendationRadii(lat, lon, recommendation)
      return isPointInsideZone(lat, lon, zones[0])
    })
  }, [focusedRadiusPriorityIndex, hotelsQuery.data, recommendation])

  const airbnb = useMemo(() => {
    const fc = airbnbQuery.data as { features?: unknown[] } | null
    if (!fc?.features || !Array.isArray(fc.features)) return []
    const all = fc.features as Array<{ geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }>
    if (!recommendation) return all

    const rec = recommendation as { radii_data?: unknown[]; agent_output?: unknown }
    const radiiRaw = Array.isArray(rec.radii_data) ? rec.radii_data : []
    const ordered = orderRadiiByLlmNarrative(String(rec.agent_output ?? ''), radiiRaw)
    const idx = typeof focusedRadiusPriorityIndex === 'number' ? focusedRadiusPriorityIndex : -1
    const zones = idx === -1 ? ordered : ordered[idx] ? [ordered[idx]] : []

    return all.filter((feature) => {
      const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : null
      const lon = coords ? tryParseNumber(coords[0]) : null
      const lat = coords ? tryParseNumber(coords[1]) : null
      if (lat == null || lon == null) return false
      if (zones.length === 0) return false
      if (idx === -1) return isPointInsideRecommendationRadii(lat, lon, recommendation)
      return isPointInsideZone(lat, lon, zones[0])
    })
  }, [airbnbQuery.data, focusedRadiusPriorityIndex, recommendation])

  const apartmentTypeOptions = useMemo(() => {
    const set = new Set<string>()
    apartments.forEach((l) => {
      const v = safeString(l.property_type_other) || safeString(l.property_type)
      if (v) set.add(v)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'))
  }, [apartments])

  const hotelTypeOptions = useMemo(() => {
    const set = new Set<string>()
    hotels.forEach((f) => {
      const v = safeString(f.properties?.type)
      if (v) set.add(v)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'))
  }, [hotels])

  const filteredApartments = useMemo(() => {
    const q = searchQuery
    const typeFilter = apartmentType
    const priceFilter = apartmentMonthlyPrice

    const hasPriceConstraint = priceFilter.min != null || priceFilter.max != null

    return apartments.filter((listing) => {
      const lat = tryParseNumber(listing.latitude)
      const lon = tryParseNumber(listing.longitude)
      const typeLabel = safeString(listing.property_type_other) || safeString(listing.property_type)

      if (typeFilter !== 'all' && typeLabel !== typeFilter) return false

      if (
        !matchesSearch(
          [
            safeString(listing.publisher_name),
            typeLabel,
            safeString(listing.city),
            safeString(listing.neighborhood),
            safeString(listing.street),
            safeString(listing.house_number),
            safeString(listing.phone_number),
            lat != null && lon != null ? `${lat},${lon}` : '',
          ],
          q,
        )
      ) {
        return false
      }

      if (!hasPriceConstraint) return true

      const units = Array.isArray(listing.units) ? (listing.units as Array<Record<string, unknown>>) : []
      const unitPrices = units.map((u) => tryParseNumber(u?.monthly_price)).filter((n): n is number => n != null)
      if (unitPrices.length === 0) return false
      return unitPrices.some((p) => inRange(p, priceFilter))
    })
  }, [apartments, apartmentMonthlyPrice, apartmentType, searchQuery])

  const filteredHotels = useMemo(() => {
    const q = searchQuery
    const typeFilter = hotelType
    const ratingMin = hotelRatingMin

    return hotels.filter((feature) => {
      const props = feature.properties ?? {}
      const t = safeString(props.type)
      const rating = tryParseNumber(props.rating_value)
      if (typeFilter !== 'all' && t !== typeFilter) return false
      if (ratingMin != null && (rating == null || rating < ratingMin)) return false

      return matchesSearch(
        [
          safeString(props.name),
          t,
          safeString(props.location_fulladdress),
          safeString(props.stat_2022),
          safeString(props.url),
        ],
        q,
      )
    })
  }, [hotels, hotelRatingMin, hotelType, searchQuery])

  const filteredAirbnb = useMemo(() => {
    const q = searchQuery
    const price = airbnbNightPrice
    const capMin = airbnbCapacityMin
    const ratingMin = airbnbRatingMin

    const hasPriceConstraint = price.min != null || price.max != null

    return airbnb.filter((feature) => {
      const props = feature.properties ?? {}
      const p = tryParseNumber(props.price_per_night)
      const cap = tryParseNumber(props.person_capacity)
      const rating = tryParseNumber(props.rating_value)

      if (hasPriceConstraint && !inRange(p, price)) return false
      if (capMin != null && (cap == null || cap < capMin)) return false
      if (ratingMin != null && (rating == null || rating < ratingMin)) return false

      return matchesSearch(
        [
          safeString(props.title),
          safeString(props.stat_2022),
          safeString(props.url),
          cap != null ? `capacity ${cap}` : '',
          rating != null ? `rating ${rating}` : '',
        ],
        q,
      )
    })
  }, [airbnb, airbnbCapacityMin, airbnbNightPrice, airbnbRatingMin, searchQuery])

  const tabs = visibleTabs ?? ['apartments', 'hotels', 'airbnb']
  const defaultValue = defaultTab ?? tabs[0] ?? 'apartments'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" dir="rtl" lang="he">
      <header className="shrink-0 px-3 pb-2 pt-3">
        <h2 className="text-sm font-semibold text-card-foreground">{headerTitle ?? 'מאגר מקומות לינה'}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {headerSubtitle ?? 'אין משתמש מחובר — מציגים את כל הדירות, המלונות ונכסי ה-Airbnb.'}
        </p>
      </header>

      <Tabs defaultValue={defaultValue} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tabs.length > 1 ? (
          <TabsList className="mx-3 grid h-auto w-[calc(100%-1.5rem)] shrink-0 grid-cols-3 rounded-xl bg-muted/60 p-1">
            {tabs.includes('apartments') ? (
              <TabsTrigger
                value="apartments"
                className="text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                דירות
              </TabsTrigger>
            ) : null}
            {tabs.includes('hotels') ? (
              <TabsTrigger
                value="hotels"
                className="text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                מלונות
              </TabsTrigger>
            ) : null}
            {tabs.includes('airbnb') ? (
              <TabsTrigger
                value="airbnb"
                className="text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                Airbnb
              </TabsTrigger>
            ) : null}
          </TabsList>
        ) : null}

        {tabs.includes('apartments') ? (
        <TabsContent
          value="apartments"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <div className="shrink-0 space-y-2 px-3 pb-3 pt-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש חופשי…"
              aria-label="חיפוש"
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                value={apartmentMonthlyPrice.min ?? ''}
                onChange={(e) =>
                  setApartmentMonthlyPrice((prev) => ({ ...prev, min: parseNullableNumber(e.target.value) }))
                }
                placeholder="מינ׳ מחיר חודשי"
                aria-label="מינימום מחיר חודשי"
                className="h-9"
              />
              <Input
                inputMode="numeric"
                value={apartmentMonthlyPrice.max ?? ''}
                onChange={(e) =>
                  setApartmentMonthlyPrice((prev) => ({ ...prev, max: parseNullableNumber(e.target.value) }))
                }
                placeholder="מקס׳ מחיר חודשי"
                aria-label="מקסימום מחיר חודשי"
                className="h-9"
              />
              <select
                value={apartmentType}
                onChange={(e) => setApartmentType(e.target.value)}
                aria-label="סוג נכס"
                className="col-span-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">כל הסוגים</option>
                {apartmentTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 pe-1">
            <div className="space-y-3 px-3 pb-4">
          {apartmentsQuery.loading ? (
            <LoadingBlock title="דירות" />
          ) : apartmentsQuery.error ? (
            <ErrorBlock title="דירות" message={apartmentsQuery.error} />
          ) : filteredApartments.length === 0 ? (
            <EmptyState title="דירות" detail="לא נמצאו דירות להצגה." />
          ) : (
            <>
              {filteredApartments.map((listing) => {
                const id = safeString(listing.id ?? listing.uuid ?? listing.listing_id ?? listing.created_at)
                const title = safeString(listing.publisher_name) || 'דירה'
                const propertyType = safeString(listing.property_type_other) || safeString(listing.property_type)
                const lat = tryParseNumber(listing.latitude)
                const lon = tryParseNumber(listing.longitude)
                const address = [
                  safeString(listing.city),
                  safeString(listing.street),
                  safeString(listing.house_number),
                  safeString(listing.neighborhood),
                ]
                  .filter(Boolean)
                  .join(', ')

                const units = Array.isArray(listing.units) ? (listing.units as Array<Record<string, unknown>>) : []
                const priced = units
                  .map((u) => u?.monthly_price)
                  .filter((v) => v != null && v !== '')
                  .map((v) => Number(v))
                  .filter((n) => Number.isFinite(n))

                const minMonthly = priced.length > 0 ? Math.min(...priced) : null
                const phone = safeString(listing.phone_number)

                const canFocus = onFocusLocation && lat != null && lon != null

                return (
                  <ClickableCard
                    key={id || title}
                    onClick={
                      canFocus
                        ? () =>
                            onFocusLocation({
                              kind: 'apartments',
                              latitude: lat!,
                              longitude: lon!,
                              id: id || null,
                            })
                        : undefined
                    }
                  >
                    <Card className="rounded-2xl border-border/80 bg-card shadow-card transition-colors hover:bg-muted/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{title}</CardTitle>
                        {address ? <p className="text-xs text-muted-foreground">{address}</p> : null}
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            <span className="text-card-foreground">סוג:</span> {propertyType || '—'}
                          </span>
                          <span>
                            <span className="text-card-foreground">יחידות:</span> {units.length.toLocaleString()}
                          </span>
                          <span>
                            <span className="text-card-foreground">מינ׳ חודשי:</span>{' '}
                            {minMonthly != null ? formatMoney(minMonthly) : '—'}
                          </span>
                        </div>
                        {phone ? (
                          <p className="text-xs text-muted-foreground">
                            <span className="text-card-foreground">טלפון:</span> {phone}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </ClickableCard>
                )
              })}
            </>
          )}
            </div>
          </ScrollArea>
        </TabsContent>
        ) : null}

        {tabs.includes('hotels') ? (
        <TabsContent value="hotels" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <div className="shrink-0 space-y-2 px-3 pb-3 pt-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש חופשי…"
              aria-label="חיפוש"
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                value={hotelRatingMin ?? ''}
                onChange={(e) => setHotelRatingMin(parseNullableNumber(e.target.value))}
                placeholder="דירוג מינ׳"
                aria-label="דירוג מינימום"
                className="h-9"
              />
              <div />
              <select
                value={hotelType}
                onChange={(e) => setHotelType(e.target.value)}
                aria-label="סוג מלון"
                className="col-span-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">כל הסוגים</option>
                {hotelTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 pe-1">
            <div className="space-y-3 px-3 pb-4">
          {hotelsQuery.loading ? (
            <LoadingBlock title="מלונות" />
          ) : hotelsQuery.error ? (
            <ErrorBlock title="מלונות" message={hotelsQuery.error} />
          ) : filteredHotels.length === 0 ? (
            <EmptyState title="מלונות" detail="לא נמצאו מלונות להצגה." />
          ) : (
            <>
              {filteredHotels.map((feature) => {
                const props = feature.properties ?? {}
                const uuid = safeString(props.uuid)
                const name = safeString(props.name) || 'מלון'
                const type = safeString(props.type)
                const rating = safeString(props.rating_value)
                const address = safeString(props.location_fulladdress)
                const stat2022 = safeString(props.stat_2022)
                const url = safeString(props.url)
                const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : null
                const lon = coords ? tryParseNumber(coords[0]) : null
                const lat = coords ? tryParseNumber(coords[1]) : null
                const canFocus = onFocusLocation && lat != null && lon != null

                return (
                  <ClickableCard
                    key={uuid || name}
                    onClick={
                      canFocus
                        ? () =>
                            onFocusLocation({
                              kind: 'hotels',
                              latitude: lat!,
                              longitude: lon!,
                              uuid: uuid || null,
                            })
                        : undefined
                    }
                  >
                    <Card className="rounded-2xl border-border/80 bg-card shadow-card transition-colors hover:bg-muted/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{name}</CardTitle>
                        {address ? <p className="text-xs text-muted-foreground">{address}</p> : null}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            <span className="text-card-foreground">סוג:</span> {type || '—'}
                          </span>
                          <span>
                            <span className="text-card-foreground">דירוג:</span> {rating || '—'}
                          </span>
                          <span>
                            <span className="text-card-foreground">אזור:</span> {stat2022 || '—'}
                          </span>
                        </div>
                        {url ? <ExternalLink href={url} label="צפייה בפרטים" /> : null}
                      </CardContent>
                    </Card>
                  </ClickableCard>
                )
              })}
            </>
          )}
            </div>
          </ScrollArea>
        </TabsContent>
        ) : null}

        {tabs.includes('airbnb') ? (
        <TabsContent value="airbnb" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <div className="shrink-0 space-y-2 px-3 pb-3 pt-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש חופשי…"
              aria-label="חיפוש"
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                value={airbnbNightPrice.min ?? ''}
                onChange={(e) =>
                  setAirbnbNightPrice((prev) => ({ ...prev, min: parseNullableNumber(e.target.value) }))
                }
                placeholder="מינ׳ מחיר ללילה"
                aria-label="מינימום מחיר ללילה"
                className="h-9"
              />
              <Input
                inputMode="numeric"
                value={airbnbNightPrice.max ?? ''}
                onChange={(e) =>
                  setAirbnbNightPrice((prev) => ({ ...prev, max: parseNullableNumber(e.target.value) }))
                }
                placeholder="מקס׳ מחיר ללילה"
                aria-label="מקסימום מחיר ללילה"
                className="h-9"
              />
              <Input
                inputMode="numeric"
                value={airbnbCapacityMin ?? ''}
                onChange={(e) => setAirbnbCapacityMin(parseNullableNumber(e.target.value))}
                placeholder="קיבולת מינ׳"
                aria-label="קיבולת מינימום"
                className="h-9"
              />
              <Input
                inputMode="numeric"
                value={airbnbRatingMin ?? ''}
                onChange={(e) => setAirbnbRatingMin(parseNullableNumber(e.target.value))}
                placeholder="דירוג מינ׳"
                aria-label="דירוג מינימום"
                className="h-9"
              />
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 pe-1">
            <div className="space-y-3 px-3 pb-4">
          {airbnbQuery.loading ? (
            <LoadingBlock title="Airbnb" />
          ) : airbnbQuery.error ? (
            <ErrorBlock title="Airbnb" message={airbnbQuery.error} />
          ) : filteredAirbnb.length === 0 ? (
            <EmptyState title="Airbnb" detail="לא נמצאו נכסי Airbnb להצגה." />
          ) : (
            <>
              {filteredAirbnb.map((feature) => {
                const props = feature.properties ?? {}
                const uuid = safeString(props.uuid)
                const title = safeString(props.title) || 'נכס Airbnb'
                const price = props.price_per_night
                const capacity = props.person_capacity
                const rating = safeString(props.rating_value)
                const stat2022 = safeString(props.stat_2022)
                const url = safeString(props.url)
                const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : null
                const lon = coords ? tryParseNumber(coords[0]) : null
                const lat = coords ? tryParseNumber(coords[1]) : null
                const canFocus = onFocusLocation && lat != null && lon != null

                return (
                  <ClickableCard
                    key={uuid || title}
                    onClick={
                      canFocus
                        ? () =>
                            onFocusLocation({
                              kind: 'airbnb',
                              latitude: lat!,
                              longitude: lon!,
                              uuid: uuid || null,
                            })
                        : undefined
                    }
                  >
                    <Card className="rounded-2xl border-border/80 bg-card shadow-card transition-colors hover:bg-muted/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{title}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {[
                            stat2022 ? `אזור ${stat2022}` : null,
                            capacity != null && capacity !== '' ? `קיבולת ${safeString(capacity)} נפשות` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            <span className="text-card-foreground">מחיר ללילה:</span>{' '}
                            {price != null && price !== '' ? formatMoney(price) : '—'}
                          </span>
                          <span>
                            <span className="text-card-foreground">דירוג:</span> {rating || '—'}
                          </span>
                        </div>
                        {url ? <ExternalLink href={url} label="צפייה בנכס" /> : null}
                      </CardContent>
                    </Card>
                  </ClickableCard>
                )
              })}
            </>
          )}
            </div>
          </ScrollArea>
        </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}

