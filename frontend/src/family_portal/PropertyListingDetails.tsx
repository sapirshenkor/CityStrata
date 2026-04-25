import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Building2, Home, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import UserBar from '@/components/UserBar'
import { getPropertyListing } from '@/services/api'

interface PropertyUnit {
  id: string
  floor?: number | null
  rooms: number
  bathrooms?: number
  monthly_price?: number | null
  rental_period?: string | null
  is_occupied?: boolean
  description?: string | null
  has_mamad?: boolean
  has_accessibility?: boolean
  allows_pets?: boolean
  has_ac?: boolean
  has_elevator?: boolean
  is_furnished?: boolean
  has_building_shelter?: boolean
}

interface PropertyListing {
  id: string
  property_type: string
  property_type_other?: string | null
  city: string
  street: string
  house_number: string
  neighborhood?: string | null
  total_floors?: number | null
  parking_spots?: number | null
  publisher_name: string
  phone_number: string
  units: PropertyUnit[]
}

function boolLabel(value?: boolean): string {
  return value ? 'כן' : 'לא'
}

export default function PropertyListingDetails() {
  const { listingId } = useParams<{ listingId: string }>()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['family', 'property-listing', listingId],
    queryFn: async (): Promise<PropertyListing> => {
      const { data } = await getPropertyListing(listingId)
      return data as PropertyListing
    },
    enabled: Boolean(listingId),
  })

  if (isLoading) {
    return (
      <div className="dashboard-app flex min-h-screen items-center justify-center" dir="rtl">
        <p className="text-sm text-muted-foreground">טוען מודעה...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="dashboard-app flex min-h-screen flex-col items-center justify-center gap-3 p-4" dir="rtl">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'לא ניתן לטעון את פרטי המודעה.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            נסה שוב
          </Button>
          <Button asChild>
            <Link to="/family">חזרה ללוח המשפחות</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-app min-h-screen" dir="rtl">
      <header className="dashboard-app__gradient px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-9 border border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link to="/family" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              חזרה ללוח המשפחות
            </Link>
          </Button>
          <UserBar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
              פרטי מודעת דיור
            </CardTitle>
            <CardDescription>
              {data.city}, {data.street} {data.house_number}
              {data.neighborhood ? ` · ${data.neighborhood}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">סוג נכס: </span>
              <strong>{data.property_type_other || data.property_type}</strong>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">סה"כ קומות: </span>
              <strong>{data.total_floors ?? '-'}</strong>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">מספר חניות: </span>
              <strong>{data.parking_spots ?? 0}</strong>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">שם מפרסם: </span>
              <strong>{data.publisher_name}</strong>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-muted-foreground">טלפון: </span>
              <strong>{data.phone_number}</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
              <Home className="h-5 w-5 text-primary" aria-hidden />
              יחידות דיור ({data.units.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.units.map((unit, idx) => (
              <div key={unit.id} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-2 text-sm font-semibold text-foreground">יחידה {idx + 1}</p>
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">קומה: </span>
                    <strong>{unit.floor ?? '-'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">חדרים: </span>
                    <strong>{unit.rooms}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">אמבטיות: </span>
                    <strong>{unit.bathrooms ?? 1}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">מחיר חודשי: </span>
                    <strong>{unit.monthly_price ?? '-'}</strong>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">משך שכירות: </span>
                    <strong>{unit.rental_period || '-'}</strong>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-border bg-card p-2">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" />
                    מאפיינים
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div>ממ"ד: {boolLabel(unit.has_mamad)}</div>
                    <div>נגישות: {boolLabel(unit.has_accessibility)}</div>
                    <div>חיות מחמד: {boolLabel(unit.allows_pets)}</div>
                    <div>מזגן: {boolLabel(unit.has_ac)}</div>
                    <div>מעלית: {boolLabel(unit.has_elevator)}</div>
                    <div>מרוהט: {boolLabel(unit.is_furnished)}</div>
                    <div>מקלט: {boolLabel(unit.has_building_shelter)}</div>
                    <div>תפוס: {boolLabel(unit.is_occupied)}</div>
                  </div>
                </div>

                {unit.description ? (
                  <p className="mt-3 text-sm text-muted-foreground">{unit.description}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
