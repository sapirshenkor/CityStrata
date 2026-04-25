import { useMemo } from 'react'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardAggregateMetrics } from '@/types/dashboard'

/** Categorical fills: distinct, no purple (pie segments are not brand). */
const CHART_COLORS = [
  '#8B4513',
  '#F39C12',
  '#52BE80',
  '#E74C3C',
  '#2563EB',
  '#0EA5E9',
  '#14B8A6',
]

function formatArea(m2: number) {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`
  if (m2 >= 10_000) return `${(m2 / 1_000_000).toFixed(2)} km²`
  return `${Math.round(m2).toLocaleString()} m²`
}

export interface DataPanelProps {
  metrics: DashboardAggregateMetrics | null
  selectedStat2022: number | null
  loading: boolean
  /** True when areas or metrics queries failed — avoid empty-state copy; refer to map/banner. */
  insightsBlocked?: boolean
  /** Legitimate empty dataset (boundaries OK but nothing to aggregate). */
  isEmpty?: boolean
  emptyDetail?: string
}

export function DataPanel({
  metrics,
  selectedStat2022,
  loading,
  insightsBlocked,
  isEmpty,
  emptyDetail,
}: DataPanelProps) {
  const chartData = useMemo(() => {
    if (!metrics) return []
    return [
      { name: 'Coffee shops', value: metrics.coffee_shops_count },
      { name: 'Restaurants', value: metrics.restaurants_count },
      { name: 'Education', value: metrics.institutions_count },
      { name: 'Airbnb listings', value: metrics.airbnb_count },
      { name: 'Hotels', value: metrics.hotels_count },
      { name: 'Matnasim', value: metrics.matnasim_count },
      { name: 'OSM facilities', value: metrics.osm_facilities_count },
    ].filter((d) => d.value > 0)
  }, [metrics])

  const scopeLabel =
    selectedStat2022 == null
      ? 'Whole city (aggregated statistical areas)'
      : `Statistical area ${selectedStat2022}`

  if (loading && !metrics) {
    return (
      <div className="flex h-full min-h-[min(220px,40dvh)] flex-col gap-4 lg:min-h-0">
        <Skeleton className="dashboard-app__skeleton h-40 w-full rounded-lg" />
        <Skeleton className="dashboard-app__skeleton h-48 w-full flex-1 rounded-lg" />
      </div>
    )
  }

  if (insightsBlocked && !metrics) {
    return (
      <Card className="h-full min-h-[min(220px,40dvh)] rounded-2xl border-border/80 bg-card shadow-card lg:min-h-0">
        <CardHeader>
          <CardTitle className="text-base">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Insights cannot load while data requests are failing. Use Retry on the map or above the KPIs,
            then Refresh data if needed.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isEmpty && !metrics) {
    return (
      <Card className="h-full min-h-[min(220px,40dvh)] rounded-2xl border-border/80 bg-card shadow-card lg:min-h-0">
        <CardHeader>
          <CardTitle className="text-base">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {emptyDetail ??
              'No metrics are available for this view yet. Ensure statistical areas loaded, then try Refresh.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return null
  }

  const cardClass = 'rounded-2xl border-border/80 bg-card shadow-card'

  return (
    <div className="flex h-full min-h-[min(220px,40dvh)] flex-col gap-4 overflow-y-auto pe-1 lg:min-h-0">
      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Venue mix</CardTitle>
          <p className="text-xs text-muted-foreground">{scopeLabel}</p>
        </CardHeader>
        <CardContent className="h-56">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No venues in this selection.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={`${entry.name}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    return [Number.isFinite(n) ? n.toLocaleString() : '—', 'Count']
                  }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Area & capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm text-card-foreground">
            <div className="flex justify-between gap-4 border-b border-border/80 pb-2">
              <dt className="text-muted-foreground">Land area</dt>
              <dd className="font-medium tabular-nums">{formatArea(metrics.area_m2)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/80 pb-2">
              <dt className="text-muted-foreground">Airbnb guest capacity (est.)</dt>
              <dd className="font-medium tabular-nums">
                {metrics.total_airbnb_capacity.toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Data sources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Summary counts for education, Airbnb, restaurants, and coffee shops follow the backend{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-card-foreground">
              StatisticalAreaSummary
            </code>{' '}
            model. Hotels, matnasim, and OSM points are counted from their GeoJSON endpoints for the active
            filter ({selectedStat2022 == null ? 'municipality' : `area ${selectedStat2022}`}).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
