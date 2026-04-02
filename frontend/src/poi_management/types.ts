/**
 * URL segment for /api/poi/{category} — must match backend PoiCategory enum values.
 */
export const POI_CATEGORIES = [
  'airbnb_listings',
  'coffee_shops',
  'educational_institutions',
  'hotel_listings',
  'matnasim',
  'restaurants',
  'synagogues',
] as const

export type PoiCategory = (typeof POI_CATEGORIES)[number]

export function isPoiCategory(value: string): value is PoiCategory {
  return (POI_CATEGORIES as readonly string[]).includes(value)
}

/** Shared form fields; optional institution code for educational_institutions (DB: institution_code). */
export interface PoiCommonFormValues {
  name: string
  address: string
  type?: string
  institutionCode?: string
}

/** GET /api/poi/{category} — rows mirror DB JSON; narrowed in adapters. */
export type PoiEntityRow = Record<string, unknown>

/** Paginated list from GET /api/poi/{category}?page=&page_size= */
export interface PoiListPage {
  items: PoiEntityRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PoiCategoryMeta {
  category: PoiCategory
  label: string
  shortLabel: string
  description: string
}
