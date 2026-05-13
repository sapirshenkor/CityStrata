import { useMemo, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAirbnbListings, useHotels, usePropertyListings } from '@/hooks/useMapData'

export type MapFocusLocation = {
  latitude: number
  longitude: number
  zoom?: number
}

export type FocusedListing =
  | { kind: 'apartments'; latitude: number; longitude: number; id?: string | null }
  | { kind: 'hotels'; latitude: number; longitude: number; uuid?: string | null }
  | { kind: 'airbnb'; latitude: number; longitude: number; uuid?: string | null }

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
}: {
  onFocusLocation?: (focused: FocusedListing) => void
}) {
  const apartmentsQuery = usePropertyListings()
  const hotelsQuery = useHotels()
  const airbnbQuery = useAirbnbListings()

  const apartments = useMemo(() => {
    if (!Array.isArray(apartmentsQuery.data)) return []
    return apartmentsQuery.data as Array<Record<string, unknown>>
  }, [apartmentsQuery.data])

  const hotels = useMemo(() => {
    const fc = hotelsQuery.data as { features?: unknown[] } | null
    if (!fc?.features || !Array.isArray(fc.features)) return []
    return fc.features as Array<{ geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }>
  }, [hotelsQuery.data])

  const airbnb = useMemo(() => {
    const fc = airbnbQuery.data as { features?: unknown[] } | null
    if (!fc?.features || !Array.isArray(fc.features)) return []
    return fc.features as Array<{ geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }>
  }, [airbnbQuery.data])

  return (
    <div className="flex min-h-0 flex-1 flex-col" dir="rtl" lang="he">
      <header className="px-3 pb-2 pt-3">
        <h2 className="text-sm font-semibold text-card-foreground">מאגר מקומות לינה</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          אין משתמש מחובר — מציגים את כל הדירות, המלונות ונכסי ה-Airbnb.
        </p>
      </header>

      <Tabs defaultValue="apartments" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 grid h-auto w-[calc(100%-1.5rem)] grid-cols-3 rounded-xl bg-muted/60 p-1">
          <TabsTrigger
            value="apartments"
            className="text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            דירות
          </TabsTrigger>
          <TabsTrigger
            value="hotels"
            className="text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            מלונות
          </TabsTrigger>
          <TabsTrigger
            value="airbnb"
            className="text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            Airbnb
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apartments" className="mt-0 min-h-0 flex-1 px-3 pb-4 pt-3 data-[state=inactive]:hidden">
          {apartmentsQuery.loading ? (
            <LoadingBlock title="דירות" />
          ) : apartmentsQuery.error ? (
            <ErrorBlock title="דירות" message={apartmentsQuery.error} />
          ) : apartments.length === 0 ? (
            <EmptyState title="דירות" detail="לא נמצאו דירות להצגה." />
          ) : (
            <div className="space-y-3">
              {apartments.map((listing) => {
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="hotels" className="mt-0 min-h-0 flex-1 px-3 pb-4 pt-3 data-[state=inactive]:hidden">
          {hotelsQuery.loading ? (
            <LoadingBlock title="מלונות" />
          ) : hotelsQuery.error ? (
            <ErrorBlock title="מלונות" message={hotelsQuery.error} />
          ) : hotels.length === 0 ? (
            <EmptyState title="מלונות" detail="לא נמצאו מלונות להצגה." />
          ) : (
            <div className="space-y-3">
              {hotels.map((feature) => {
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="airbnb" className="mt-0 min-h-0 flex-1 px-3 pb-4 pt-3 data-[state=inactive]:hidden">
          {airbnbQuery.loading ? (
            <LoadingBlock title="Airbnb" />
          ) : airbnbQuery.error ? (
            <ErrorBlock title="Airbnb" message={airbnbQuery.error} />
          ) : airbnb.length === 0 ? (
            <EmptyState title="Airbnb" detail="לא נמצאו נכסי Airbnb להצגה." />
          ) : (
            <div className="space-y-3">
              {airbnb.map((feature) => {
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

