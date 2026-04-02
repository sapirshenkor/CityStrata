import { useQuery } from '@tanstack/react-query'
import {
  getMatchingResultForProfile,
  getRecommendationByProfile,
  getRecommendationsOverview,
} from '../services/api'

const STALE_MS = 30_000

export const recommendationsKeys = {
  all: ['recommendations'] as const,
  overview: () => [...recommendationsKeys.all, 'overview'] as const,
  detail: (profileUuid: string) => [...recommendationsKeys.all, 'detail', profileUuid] as const,
  matching: (profileUuid: string) => [...recommendationsKeys.all, 'matching', profileUuid] as const,
}

export function useRecommendationsOverviewQuery(enabled = true) {
  return useQuery({
    queryKey: recommendationsKeys.overview(),
    queryFn: async () => (await getRecommendationsOverview()).data,
    staleTime: STALE_MS,
    enabled,
  })
}

export function useRecommendationDetailQuery(profileUuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: profileUuid ? recommendationsKeys.detail(profileUuid) : ['recommendations', 'detail', 'none'],
    queryFn: async () => (await getRecommendationByProfile(profileUuid!)).data,
    enabled: enabled && Boolean(profileUuid),
    staleTime: STALE_MS,
  })
}

export function useMatchingResultQuery(profileUuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: profileUuid ? recommendationsKeys.matching(profileUuid) : ['recommendations', 'matching', 'none'],
    queryFn: async () => (await getMatchingResultForProfile(profileUuid!)).data,
    enabled: enabled && Boolean(profileUuid),
    staleTime: STALE_MS,
  })
}
