import { useMemo } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchStatisticalAreaSummary,
  fetchStatisticalAreas,
  fetchVenueFeatureCount,
} from '@/services/dashboardApi'
import { formatQueryError } from '@/lib/formatQueryError'
import type { DashboardAggregateMetrics, StatisticalAreaSummary } from '@/types/dashboard'
import { dashboardKeys } from '../queryKeys'

const STALE_MS = 60_000

function aggregateSummaries(summaries: StatisticalAreaSummary[]): Omit<
  DashboardAggregateMetrics,
  'hotels_count' | 'matnasim_count' | 'osm_facilities_count'
> {
  return summaries.reduce(
    (acc, s) => ({
      area_m2: acc.area_m2 + s.area_m2,
      institutions_count: acc.institutions_count + s.institutions_count,
      airbnb_count: acc.airbnb_count + s.airbnb_count,
      restaurants_count: acc.restaurants_count + s.restaurants_count,
      coffee_shops_count: acc.coffee_shops_count + s.coffee_shops_count,
      total_airbnb_capacity:
        acc.total_airbnb_capacity + (s.total_airbnb_capacity ?? 0),
    }),
    {
      area_m2: 0,
      institutions_count: 0,
      airbnb_count: 0,
      restaurants_count: 0,
      coffee_shops_count: 0,
      total_airbnb_capacity: 0,
    },
  )
}

export function useStatisticalAreasQuery() {
  return useQuery({
    queryKey: dashboardKeys.statisticalAreas(),
    queryFn: fetchStatisticalAreas,
    staleTime: STALE_MS,
  })
}

export function useStatisticalAreaSummaryQuery(stat2022: number | null, enabled: boolean) {
  return useQuery({
    queryKey: stat2022 != null ? dashboardKeys.summary(stat2022) : ['dashboard', 'summary', 'none'],
    queryFn: () => fetchStatisticalAreaSummary(stat2022!),
    enabled: enabled && stat2022 != null,
    staleTime: STALE_MS,
  })
}

/** Fetches every area summary when viewing city-wide metrics (for accurate aggregation). */
export function useAllAreaSummariesQuery(statIds: number[] | undefined, enabled: boolean) {
  const results = useQueries({
    queries: (statIds ?? []).map((id) => ({
      queryKey: dashboardKeys.summary(id),
      queryFn: () => fetchStatisticalAreaSummary(id),
      enabled: enabled && statIds != null && statIds.length > 0,
      staleTime: STALE_MS,
    })),
  })

  const isLoading = results.some((q) => q.isLoading)
  const isFetching = results.some((q) => q.isFetching)
  const isError = results.some((q) => q.isError)
  const failed = results.find((q) => q.isError)
  const summaries = results
    .map((q) => q.data)
    .filter((d): d is StatisticalAreaSummary => d != null)

  return {
    summaries,
    isLoading,
    isFetching,
    isError,
    error: failed?.error ?? null,
  }
}

/**
 * Hotels, matnasim, OSM facility counts from GeoJSON lengths.
 * Pass `area: null` for whole-municipality counts.
 */
export function useVenueCountsQuery(area: number | null) {
  const hotels = useQuery({
    queryKey: dashboardKeys.venueCount('hotels', area),
    queryFn: () => fetchVenueFeatureCount('hotels', area),
    staleTime: STALE_MS,
  })
  const matnasim = useQuery({
    queryKey: dashboardKeys.venueCount('matnasim', area),
    queryFn: () => fetchVenueFeatureCount('matnasim', area),
    staleTime: STALE_MS,
  })
  const osm = useQuery({
    queryKey: dashboardKeys.venueCount('osm-facilities', area),
    queryFn: () => fetchVenueFeatureCount('osm-facilities', area),
    staleTime: STALE_MS,
  })

  const isLoading = hotels.isLoading || matnasim.isLoading || osm.isLoading
  const isFetching = hotels.isFetching || matnasim.isFetching || osm.isFetching
  const isError = hotels.isError || matnasim.isError || osm.isError
  const error = hotels.error ?? matnasim.error ?? osm.error ?? null

  return {
    hotels_count: hotels.data ?? 0,
    matnasim_count: matnasim.data ?? 0,
    osm_facilities_count: osm.data ?? 0,
    isLoading,
    isFetching,
    isError,
    error,
  }
}

/**
 * Combined metrics for KPI row + charts: single-area uses one summary + venue counts;
 * city-wide aggregates all area summaries and municipality-wide venue counts.
 */
export function useDashboardMetrics(selectedStat2022: number | null) {
  const cityWide = selectedStat2022 == null

  const areasQuery = useStatisticalAreasQuery()
  const statIds = useMemo(
    () =>
      areasQuery.data?.features
        .map((f) => Number((f.properties as { stat_2022?: number }).stat_2022))
        .filter((n) => !Number.isNaN(n)) ?? [],
    [areasQuery.data],
  )

  const {
    summaries,
    isLoading: allSummariesLoading,
    isFetching: allSummariesFetching,
    isError: allSummariesError,
    error: allSummariesErr,
  } = useAllAreaSummariesQuery(statIds, cityWide && statIds.length > 0)

  const singleSummary = useStatisticalAreaSummaryQuery(
    selectedStat2022,
    !cityWide && selectedStat2022 != null,
  )

  const venue = useVenueCountsQuery(cityWide ? null : selectedStat2022)

  const core = useMemo((): Omit<
    DashboardAggregateMetrics,
    'hotels_count' | 'matnasim_count' | 'osm_facilities_count'
  > | null => {
    if (cityWide) {
      if (summaries.length === 0) return null
      return aggregateSummaries(summaries)
    }
    if (!singleSummary.data) return null
    const s = singleSummary.data
    return {
      area_m2: s.area_m2,
      institutions_count: s.institutions_count,
      airbnb_count: s.airbnb_count,
      restaurants_count: s.restaurants_count,
      coffee_shops_count: s.coffee_shops_count,
      total_airbnb_capacity: s.total_airbnb_capacity ?? 0,
    }
  }, [cityWide, summaries, singleSummary.data])

  const metrics: DashboardAggregateMetrics | null = useMemo(() => {
    if (!core) return null
    return {
      ...core,
      hotels_count: venue.hotels_count,
      matnasim_count: venue.matnasim_count,
      osm_facilities_count: venue.osm_facilities_count,
    }
  }, [core, venue.hotels_count, venue.matnasim_count, venue.osm_facilities_count])

  const coreLoading =
    areasQuery.isLoading || (cityWide ? allSummariesLoading : singleSummary.isLoading)

  const loading = coreLoading || venue.isLoading

  const isFetching =
    areasQuery.isFetching ||
    (cityWide ? allSummariesFetching : singleSummary.isFetching) ||
    venue.isFetching

  const metricsFetchFailed =
    (cityWide && allSummariesError) ||
    (!cityWide && singleSummary.isError) ||
    venue.isError

  const metricsErrorRaw =
    (cityWide && allSummariesError ? allSummariesErr : null) ??
    (!cityWide && singleSummary.isError ? singleSummary.error : null) ??
    (venue.isError ? venue.error : null)

  const metricsErrorMessage = metricsFetchFailed ? formatQueryError(metricsErrorRaw) : null

  const metricsEmpty =
    !loading &&
    !metricsFetchFailed &&
    metrics == null &&
    areasQuery.isSuccess &&
    !areasQuery.isError &&
    (cityWide
      ? statIds.length === 0 ||
        (statIds.length > 0 &&
          !allSummariesLoading &&
          !allSummariesError &&
          summaries.length === 0)
      : selectedStat2022 != null &&
        singleSummary.isFetched &&
        !singleSummary.isLoading &&
        !singleSummary.isError &&
        singleSummary.data == null)

  return {
    metrics,
    loading,
    isFetching,
    areasError: areasQuery.error,
    refetchAreas: areasQuery.refetch,
    statIds,
    metricsFetchFailed,
    metricsErrorMessage,
    metricsEmpty,
  }
}

/** Invalidate all dashboard queries (client cache refresh). */
export function useInvalidateDashboard() {
  const client = useQueryClient()
  return () =>
    client.invalidateQueries({
      queryKey: dashboardKeys.all,
    })
}
