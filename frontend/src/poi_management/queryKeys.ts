import type { PoiCategory } from './types'

export const poiQueryKeys = {
  all: ['poi'] as const,
  list: (category: PoiCategory, page: number) =>
    [...poiQueryKeys.all, category, page] as const,
}
