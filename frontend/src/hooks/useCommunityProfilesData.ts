import { useQuery } from '@tanstack/react-query'
import { getCommunityProfiles } from '../services/api'

const STALE_MS = 30_000

export const communityProfilesKeys = {
  all: ['community-profiles'] as const,
  list: () => [...communityProfilesKeys.all, 'list'] as const,
}

export function useCommunityProfilesQuery(enabled = true) {
  return useQuery({
    queryKey: communityProfilesKeys.list(),
    queryFn: async () => (await getCommunityProfiles()).data,
    staleTime: STALE_MS,
    enabled,
  })
}
