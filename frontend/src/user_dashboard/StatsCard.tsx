import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  loading?: boolean
  className?: string
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  className,
}: StatsCardProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden rounded-xl border-border/80 bg-card shadow-card',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <div className="dashboard-app__kpi-icon p-2">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="dashboard-app__skeleton mb-1 h-8 w-24 rounded-md" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight text-card-foreground">{value}</p>
        )}
        {description != null && description !== '' && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
