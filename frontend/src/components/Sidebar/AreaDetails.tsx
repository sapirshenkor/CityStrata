import { X } from 'lucide-react'
import { useAreaSummary } from '../../hooks/useMapData'
import { formatArea, formatNumber } from '../../utils/formatters'
import type { StatisticalAreaSummary } from '@/types/dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface AreaDetailsProps {
  stat2022: number
  onClose: () => void
}

export default function AreaDetails({ stat2022, onClose }: AreaDetailsProps) {
  const { data, loading, error } = useAreaSummary(stat2022)
  const summary = data as StatisticalAreaSummary | null | undefined

  return (
    <Card className="border-[#e0e0e0] shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base text-[#333]">Area {stat2022}</CardTitle>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">Error: {error}</p>}
        {summary && (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Area</dt>
              <dd className="font-medium tabular-nums text-[#333]">{formatArea(summary.area_m2)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Institutions</dt>
              <dd className="font-medium tabular-nums">{formatNumber(summary.institutions_count)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Airbnb listings</dt>
              <dd className="font-medium tabular-nums">{formatNumber(summary.airbnb_count)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Total capacity</dt>
              <dd className="font-medium tabular-nums">
                {formatNumber(summary.total_airbnb_capacity ?? 0)} people
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Restaurants</dt>
              <dd className="font-medium tabular-nums">{formatNumber(summary.restaurants_count)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#666]">Coffee shops</dt>
              <dd className="font-medium tabular-nums">{formatNumber(summary.coffee_shops_count)}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
