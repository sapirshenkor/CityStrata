import { describe, expect, it } from 'vitest'
import { mapQueryKeys } from '@/hooks/mapQueryKeys'

describe('mapQueryKeys', () => {
  it('keeps stable root and statistical area keys', () => {
    expect(mapQueryKeys.all).toEqual(['map'])
    expect(mapQueryKeys.statisticalAreas()).toEqual(['map', 'statistical-areas'])
    expect(mapQueryKeys.clusterAssignments()).toEqual(['map', 'cluster-assignments'])
  })

  it('includes filters in layer-specific keys for cache isolation', () => {
    const filters = { area: 100, min_rating: 4 }
    expect(mapQueryKeys.hotels(filters)).toEqual(['map', 'hotels', filters])
    expect(mapQueryKeys.osmFacilities(filters)).toEqual(['map', 'osm-facilities', filters])
  })

  it('scopes area summary keys by stat_2022', () => {
    expect(mapQueryKeys.areaSummary(26001234)).toEqual(['map', 'area-summary', 26001234])
  })
})
