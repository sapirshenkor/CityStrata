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

const CHART_COLORS = [
  '#8B4513', // coffee
  '#F39C12', // restaurants
  '#52BE80', // institutions
  '#E74C3C', // airbnb
  '#667eea', // hotels (match main app primary)
  '#9B59B6', // matnasim
  '#1ABC9C', // osm
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
}

export function DataPanel({ metrics, selectedStat2022, loading }: DataPanelProps) {
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
      <div className="flex h-full min-h-[420px] flex-col gap-4">
        <Skeleton className="dashboard-app__skeleton h-40 w-full rounded-lg" />
        <Skeleton className="dashboard-app__skeleton h-48 w-full flex-1 rounded-lg" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card className="h-full min-h-[420px] border-[#e0e0e0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle className="text-[#333]">Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#666]">No metrics available yet.</p>
        </CardContent>
      </Card>
    )
  }

  const cardClass =
    'border-[#e0e0e0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]'

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-4 overflow-y-auto pr-1">
      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#333]">Venue mix</CardTitle>
          <p className="text-xs text-[#666]">{scopeLabel}</p>
        </CardHeader>
        <CardContent className="h-56">
          {chartData.length === 0 ? (
            <p className="text-sm text-[#666]">No venues in this selection.</p>
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
                    border: '1px solid #e0e0e0',
                    fontSize: '12px',
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
          <CardTitle className="text-base text-[#333]">Area & capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm text-[#333]">
            <div className="flex justify-between gap-4 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Land area</dt>
              <dd className="font-medium tabular-nums">{formatArea(metrics.area_m2)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#e9ecef] pb-2">
              <dt className="text-[#666]">Airbnb guest capacity (est.)</dt>
              <dd className="font-medium tabular-nums">
                {metrics.total_airbnb_capacity.toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#333]">Data sources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-[#666]">
            Summary counts for education, Airbnb, restaurants, and coffee shops follow the backend{' '}
            <code className="rounded bg-[#f8f9fa] px-1 py-0.5 text-[#333]">StatisticalAreaSummary</code>{' '}
            model. Hotels, matnasim, and OSM points are counted from their GeoJSON endpoints for the
            active filter ({selectedStat2022 == null ? 'municipality' : `area ${selectedStat2022}`}).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
