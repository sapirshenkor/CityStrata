import type { PoiCategory } from './types'

export const poiQueryKeys = {
  all: ['poi'] as const,
  list: (category: PoiCategory, page: number, search: string) =>
    [...poiQueryKeys.all, category, page, search] as const,
}
