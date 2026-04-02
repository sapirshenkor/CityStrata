import { useQuery } from '@tanstack/react-query'
import {
  getAirbnbListings,
  getClusterAssignments,
  getClusterProfiles,
  getCoffeeShops,
  getHotels,
  getInstitutions,
  getMatnasim,
  getOSMFacilities,
  getOSMFacilityTypes,
  getRestaurants,
  getStatisticalAreaSummary,
  getStatisticalAreas,
  getSynagogues,
} from '../services/api'
import { mapQueryKeys } from './mapQueryKeys'

const STALE_MS = 60_000

function errMsg(e: unknown): string | null {
  if (e == null) return null
  if (e instanceof Error) return e.message
  return String(e)
}

/** Same shape as legacy hook: `{ data, loading, error }` — `loading` aliases `isLoading`. */
type LegacyShape<T> = {
  data: T | null | undefined
  loading: boolean
  error: string | null
  isFetching?: boolean
}

export function useStatisticalAreas(): LegacyShape<unknown> {
  const q = useQuery({
    queryKey: mapQueryKeys.statisticalAreas(),
    queryFn: async () => (await getStatisticalAreas()).data,
    staleTime: STALE_MS,
  })
  return {
    data: q.data ?? null,
    loading: q.isLoading,
    isFetching: q.isFetching,
    error: errMsg(q.error),
  }
}

function filtersKey(f: Record<string, unknown>) {
  return JSON.stringify(f, Object.keys(f).sort())
}

export function useInstitutions(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'institutions', filtersKey(filters)] as const,
    queryFn: async () => (await getInstitutions(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useAirbnbListings(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'airbnb', filtersKey(filters)] as const,
    queryFn: async () => (await getAirbnbListings(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useRestaurants(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'restaurants', filtersKey(filters)] as const,
    queryFn: async () => (await getRestaurants(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useCoffeeShops(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'coffee-shops', filtersKey(filters)] as const,
    queryFn: async () => (await getCoffeeShops(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useHotels(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'hotels', filtersKey(filters)] as const,
    queryFn: async () => (await getHotels(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useMatnasim(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'matnasim', filtersKey(filters)] as const,
    queryFn: async () => (await getMatnasim(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useOSMFacilities(filters: Record<string, unknown> = {}) {
  const facilityTypes = filters.facility_types as unknown
  const hasTypes =
    Array.isArray(facilityTypes) && facilityTypes.length > 0

  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'osm-facilities', filtersKey(filters)] as const,
    queryFn: async () => {
      const ft = filters.facility_types as string[] | undefined
      const params = { ...filters }
      if (ft && ft.length > 0) {
        ;(params as Record<string, unknown>).facility_types = ft.join(',')
      }
      return (await getOSMFacilities(params)).data
    },
    enabled: hasTypes,
    staleTime: STALE_MS,
  })

  return {
    data: hasTypes ? (q.data ?? null) : null,
    loading: hasTypes ? q.isLoading : false,
    isFetching: hasTypes ? q.isFetching : false,
    error: hasTypes ? errMsg(q.error) : null,
  }
}

export function useOSMFacilityTypes() {
  const q = useQuery({
    queryKey: mapQueryKeys.osmFacilityTypes(),
    queryFn: async () => {
      const res = await getOSMFacilityTypes()
      return (res.data as { types: string[] }).types
    },
    staleTime: STALE_MS * 5,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useSynagogues(filters: Record<string, unknown> = {}) {
  const q = useQuery({
    queryKey: [...mapQueryKeys.all, 'synagogues', filtersKey(filters)] as const,
    queryFn: async () => (await getSynagogues(filters)).data,
    staleTime: STALE_MS,
  })
  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}

export function useClusterAssignments() {
  const q = useQuery({
    queryKey: mapQueryKeys.clusterAssignments(),
    queryFn: async () => {
      const response = await getClusterAssignments()
      const body = response.data as {
        run_id?: string | null
        assignments?: unknown[]
      }
      const runId = body?.run_id ?? null
      const assignments = body?.assignments ?? []

      if (!runId || assignments.length === 0) {
        return null
      }

      const profilesResponse = await getClusterProfiles(runId)
      const profilesBody = profilesResponse.data as {
        profiles?: Array<{ cluster: number; name?: string; short_description?: string }>
      }
      const profiles = profilesBody?.profiles ?? []
      const byCluster = new Map<
        number,
        { name: string | undefined; description: string | undefined }
      >()
      profiles.forEach((p) => {
        byCluster.set(p.cluster, {
          name: p.name,
          description: p.short_description,
        })
      })

      const enriched = (
        assignments as Array<{
          cluster: number
          cluster_label?: string
          stat_2022: number
        }>
      ).map((a) => {
        const profile = byCluster.get(a.cluster)
        return {
          ...a,
          cluster_name: profile?.name ?? a.cluster_label ?? `Cluster ${a.cluster}`,
          cluster_description: profile?.description ?? null,
        }
      })

      return enriched.length > 0 ? enriched : null
    },
    staleTime: STALE_MS,
  })

  return {
    data: q.data ?? null,
    loading: q.isLoading,
    isFetching: q.isFetching,
    error: errMsg(q.error),
    refetch: q.refetch,
  }
}

export function useAreaSummary(stat2022: number | null | undefined) {
  const q = useQuery({
    queryKey: stat2022 != null ? mapQueryKeys.areaSummary(stat2022) : ['map', 'area-summary', 'none'],
    queryFn: async () => (await getStatisticalAreaSummary(stat2022!)).data,
    enabled: Boolean(stat2022),
    staleTime: STALE_MS,
  })

  if (!stat2022) {
    return { data: null, loading: false, error: null as string | null }
  }

  return { data: q.data ?? null, loading: q.isLoading, isFetching: q.isFetching, error: errMsg(q.error) }
}
