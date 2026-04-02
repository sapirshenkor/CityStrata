export const dashboardKeys = {
  all: ['dashboard'] as const,
  statisticalAreas: () => [...dashboardKeys.all, 'statistical-areas'] as const,
  summary: (stat2022: number) => [...dashboardKeys.all, 'summary', stat2022] as const,
  venueCount: (resource: VenueResourceKey, area: number | null) =>
    [...dashboardKeys.all, 'venue-count', resource, area ?? 'all'] as const,
}

export type VenueResourceKey = 'hotels' | 'matnasim' | 'osm-facilities'
