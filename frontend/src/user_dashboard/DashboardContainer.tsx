import { useCallback, useState } from 'react'
import {
  BedDouble,
  Building,
  Coffee,
  GraduationCap,
  Hotel,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import { MapView } from './MapView'
import { Sidebar } from './Sidebar'
import { StatsCard } from './StatsCard'
import { DataPanel } from './DataPanel'
import {
  useDashboardMetrics,
  useInvalidateDashboard,
  useStatisticalAreasQuery,
} from './hooks/useDashboardQueries'
import './dashboard.css'

export default function DashboardContainer() {
  const [selectedStat2022, setSelectedStat2022] = useState<number | null>(null)

  const { data: areasGeo, isLoading: areasLoading } = useStatisticalAreasQuery()
  const { metrics, loading, isFetching } = useDashboardMetrics(selectedStat2022)
  const invalidateDashboard = useInvalidateDashboard()

  const handleSelectArea = useCallback((stat2022: number) => {
    setSelectedStat2022(stat2022)
  }, [])

  const handleClear = useCallback(() => {
    setSelectedStat2022(null)
  }, [])

  const handleRefresh = useCallback(() => {
    void invalidateDashboard()
  }, [invalidateDashboard])

  const kpiLoading = loading

  return (
    <div className="dashboard-app flex h-screen w-full overflow-hidden">
      <Sidebar
        selectedStat2022={selectedStat2022}
        onClearSelection={handleClear}
        onRefreshData={handleRefresh}
        isRefreshing={isFetching}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="dashboard-app__gradient px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-white">
            {selectedStat2022 == null ? 'City overview' : `Area ${selectedStat2022}`}
          </h2>
          <p className="mt-1 text-sm text-white/90">
            Click a statistical area on the map to filter KPIs and insights. Use Refresh to invalidate
            the client cache and refetch.
          </p>
        </header>

        <div className="border-b border-[#e0e0e0] bg-white px-6 py-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatsCard
              title="Education"
              value={metrics?.institutions_count?.toLocaleString() ?? '—'}
              icon={GraduationCap}
              loading={kpiLoading}
            />
            <StatsCard
              title="Airbnb"
              value={metrics?.airbnb_count?.toLocaleString() ?? '—'}
              icon={BedDouble}
              loading={kpiLoading}
            />
            <StatsCard
              title="Restaurants"
              value={metrics?.restaurants_count?.toLocaleString() ?? '—'}
              icon={UtensilsCrossed}
              loading={kpiLoading}
            />
            <StatsCard
              title="Coffee shops"
              value={metrics?.coffee_shops_count?.toLocaleString() ?? '—'}
              icon={Coffee}
              loading={kpiLoading}
            />
            <StatsCard
              title="Hotels"
              value={metrics?.hotels_count?.toLocaleString() ?? '—'}
              icon={Hotel}
              loading={kpiLoading}
            />
            <StatsCard
              title="Matnasim"
              value={metrics?.matnasim_count?.toLocaleString() ?? '—'}
              icon={Building}
              loading={kpiLoading}
            />
            <StatsCard
              title="OSM facilities"
              value={metrics?.osm_facilities_count?.toLocaleString() ?? '—'}
              icon={Store}
              description="OpenStreetMap-derived points"
              loading={kpiLoading}
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 bg-[#f8f9fa] p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
          <div className="min-h-0">
            <MapView
              geojson={areasGeo}
              selectedStat2022={selectedStat2022}
              onSelectStat2022={handleSelectArea}
              loading={areasLoading}
            />
          </div>
          <div className="min-h-0">
            <DataPanel
              metrics={metrics}
              selectedStat2022={selectedStat2022}
              loading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
