import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import UserBar from '@/components/UserBar'
import { getPropertyListing } from '@/services/api'
import { PropertyListingDetailsContent, type PropertyListing } from './PropertyListingDetailsContent'

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
        <PropertyListingDetailsContent data={data} />
      </main>
    </div>
  )
}
