import { useCallback, useMemo, useState } from 'react'
import {
  BedDouble,
  Building,
  Coffee,
  GraduationCap,
  Hotel,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import { ApiErrorBanner } from '@/components/layout/ApiErrorBanner'
import { formatQueryError } from '@/lib/formatQueryError'
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

  const {
    data: areasGeo,
    isLoading: areasLoading,
    isError: areasIsError,
    error: areasErr,
    refetch: refetchAreas,
  } = useStatisticalAreasQuery()

  const {
    metrics,
    loading: metricsLoading,
    isFetching,
    metricsFetchFailed,
    metricsErrorMessage,
    metricsEmpty,
    statIds,
  } = useDashboardMetrics(selectedStat2022)

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

  const areasErrorMessage = areasIsError ? formatQueryError(areasErr) : null
  const areasEmpty = !areasLoading && !areasIsError && !(areasGeo?.features?.length)

  const showMetricsBanner = metricsFetchFailed && !areasIsError
  const insightsBlocked = areasIsError || metricsFetchFailed

  const kpiLoading = metricsLoading && !insightsBlocked

  const insightsEmptyDetail = useMemo(() => {
    if (areasEmpty) {
      return 'אין גבולות אזורים סטטיסטיים זמינים. לא ניתן לחשב מדדי לוח בקרה עד שנתוני הגיאומטריה ייטענו בהצלחה.'
    }
    if (!metricsEmpty) return undefined
    if (statIds.length === 0) {
      return 'לא נמצאו אזורים סטטיסטיים במערך הגבולות, ולכן לא ניתן לאגד מדדים לכל העיר.'
    }
    return 'לא התקבלו נתוני סיכום עבור ההיקף הנוכחי. נסו לרענן נתונים או לבחור אזור אחר.'
  }, [areasEmpty, metricsEmpty, statIds.length])

  return (
    <div className="dashboard-app flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden">
      <Sidebar
        selectedStat2022={selectedStat2022}
        onClearSelection={handleClear}
        onRefreshData={handleRefresh}
        isRefreshing={isFetching}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="dashboard-app__gradient shrink-0 px-6 py-5">
          <h2 className="text-xl font-bold tracking-tight text-white">
            {selectedStat2022 == null ? 'סקירת עיר' : `אזור ${selectedStat2022}`}
          </h2>
          <p className="mt-1 text-sm text-white/90">
            לחצו על אזור סטטיסטי במפה כדי לסנן מדדים ותובנות. השתמשו ברענון כדי לטעון
            נתונים עדכניים.
          </p>
        </header>

        {showMetricsBanner && metricsErrorMessage ? (
          <div className="shrink-0 border-b border-border/80 bg-card px-6 py-3">
            <ApiErrorBanner message={metricsErrorMessage} onRetry={() => void invalidateDashboard()} />
          </div>
        ) : null}

        <div className="shrink-0 border-b border-border/80 bg-card px-6 py-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatsCard
              title="חינוך"
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
              title="מסעדות"
              value={metrics?.restaurants_count?.toLocaleString() ?? '—'}
              icon={UtensilsCrossed}
              loading={kpiLoading}
            />
            <StatsCard
              title="בתי קפה"
              value={metrics?.coffee_shops_count?.toLocaleString() ?? '—'}
              icon={Coffee}
              loading={kpiLoading}
            />
            <StatsCard
              title="מלונות"
              value={metrics?.hotels_count?.toLocaleString() ?? '—'}
              icon={Hotel}
              loading={kpiLoading}
            />
            <StatsCard
              title={'מתנ"סים'}
              value={metrics?.matnasim_count?.toLocaleString() ?? '—'}
              icon={Building}
              loading={kpiLoading}
            />
            <StatsCard
              title="מתקני OSM"
              value={metrics?.osm_facilities_count?.toLocaleString() ?? '—'}
              icon={Store}
              description="נקודות ממקור OpenStreetMap"
              loading={kpiLoading}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] p-4 lg:overflow-hidden">
            <div className="grid min-h-0 grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6 lg:overflow-hidden">
              <div className="flex min-h-[min(260px,45dvh)] flex-col lg:h-full lg:min-h-0">
                <MapView
                  geojson={areasGeo}
                  selectedStat2022={selectedStat2022}
                  onSelectStat2022={handleSelectArea}
                  loading={areasLoading}
                  errorMessage={areasErrorMessage}
                  onRetry={() => void refetchAreas()}
                  isEmpty={areasEmpty}
                />
              </div>
              <div className="flex min-h-[min(220px,40dvh)] flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
                <DataPanel
                  metrics={metrics}
                  selectedStat2022={selectedStat2022}
                  loading={metricsLoading}
                  insightsBlocked={insightsBlocked}
                  isEmpty={!insightsBlocked && !areasIsError && (areasEmpty || metricsEmpty)}
                  emptyDetail={insightsEmptyDetail}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
