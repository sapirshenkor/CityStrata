import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PublicListingsPanel, type FocusedListing } from './PublicListingsPanel'

export function RadiusLodgingsSidebar({
  recommendation,
  onClose,
  onFocusLocation,
  focusedRadiusPriorityIndex,
}: {
  recommendation: unknown
  onClose: () => void
  onFocusLocation?: (focused: FocusedListing) => void
  focusedRadiusPriorityIndex: number
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col rounded-2xl border-border/80 bg-card shadow-card">
      <CardHeader className="shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">מקומות לינה באזור</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {focusedRadiusPriorityIndex === -1
              ? 'מציג דירות, מלונות ו-Airbnb בכל הרדיוסים (All).'
              : `מציג דירות, מלונות ו-Airbnb ברדיוס עדיפות ${focusedRadiusPriorityIndex + 1}.`}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">סגירה</span>
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col">
          <PublicListingsPanel
            recommendation={recommendation}
            onFocusLocation={onFocusLocation}
            headerTitle="מקומות לינה"
            headerSubtitle="מציג רק דירות, מלונות ו-Airbnb בתוך הרדיוס הנבחר."
            visibleTabs={['apartments', 'hotels', 'airbnb']}
            defaultTab="apartments"
            focusedRadiusPriorityIndex={focusedRadiusPriorityIndex}
          />
        </div>
      </CardContent>
    </Card>
  )
}

