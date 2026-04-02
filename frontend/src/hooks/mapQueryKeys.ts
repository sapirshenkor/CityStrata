/** TanStack Query keys for map data — keep stable for cache invalidation. */
export const mapQueryKeys = {
  all: ['map'] as const,
  statisticalAreas: () => [...mapQueryKeys.all, 'statistical-areas'] as const,
  institutions: (filters: Record<string, unknown>) =>
    [...mapQueryKeys.all, 'institutions', filters] as const,
  airbnb: (filters: Record<string, unknown>) => [...mapQueryKeys.all, 'airbnb', filters] as const,
  restaurants: (filters: Record<string, unknown>) =>
    [...mapQueryKeys.all, 'restaurants', filters] as const,
  coffeeShops: (filters: Record<string, unknown>) =>
    [...mapQueryKeys.all, 'coffee-shops', filters] as const,
  hotels: (filters: Record<string, unknown>) => [...mapQueryKeys.all, 'hotels', filters] as const,
  matnasim: (filters: Record<string, unknown>) =>
    [...mapQueryKeys.all, 'matnasim', filters] as const,
  osmFacilities: (filters: Record<string, unknown>) =>
    [...mapQueryKeys.all, 'osm-facilities', filters] as const,
  osmFacilityTypes: () => [...mapQueryKeys.all, 'osm-facility-types'] as const,
  synagogues: (filters: Record<string, unknown>) =>
    [...mapQueryKeys.all, 'synagogues', filters] as const,
  clusterAssignments: () => [...mapQueryKeys.all, 'cluster-assignments'] as const,
  areaSummary: (stat2022: number) => [...mapQueryKeys.all, 'area-summary', stat2022] as const,
}
