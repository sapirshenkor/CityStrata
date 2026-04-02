import type { PoiCategory, PoiCommonFormValues, PoiEntityRow } from './types'

function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Primary key for DELETE/PATCH URLs (uuid for most tables, id for educational_institutions). */
export function getEntityId(row: PoiEntityRow, category: PoiCategory): string {
  if (category === 'educational_institutions') {
    const v = row['id']
    return v == null ? '' : String(v)
  }
  const u = row['uuid']
  return u == null ? '' : String(u)
}

export function getDisplayName(row: PoiEntityRow, category: PoiCategory): string {
  switch (category) {
    case 'airbnb_listings':
      return str(row['title'])
    case 'coffee_shops':
    case 'restaurants':
      return str(row['title'])
    case 'hotel_listings':
      return str(row['name'])
    case 'matnasim':
      return str(row['matnas_name'])
    case 'educational_institutions':
      return str(row['institution_name'])
    case 'synagogues':
      return str(row['name'])
    default: {
      const _exhaustive: never = category
      void _exhaustive
      return ''
    }
  }
}

export function getDisplayAddress(row: PoiEntityRow, category: PoiCategory): string {
  switch (category) {
    case 'airbnb_listings':
      return str(row['location_subtitle'])
    case 'coffee_shops':
    case 'restaurants':
      return str(row['street'])
    case 'hotel_listings':
      return str(row['location_fulladdress'])
    case 'matnasim':
      return str(row['full_address'])
    case 'educational_institutions':
      return str(row['full_address'] || row['address'])
    case 'synagogues':
      return str(row['address'])
    default: {
      const _exhaustive: never = category
      void _exhaustive
      return ''
    }
  }
}

export function getDisplayType(row: PoiEntityRow, category: PoiCategory): string | null {
  switch (category) {
    case 'airbnb_listings':
      return null
    case 'coffee_shops':
    case 'restaurants':
      return str(row['category_name']) || null
    case 'hotel_listings':
      return str(row['type']) || null
    case 'matnasim':
      return null
    case 'educational_institutions':
      return str(row['education_phase'] || row['type_of_education']) || null
    case 'synagogues':
      return str(row['type']) || null
    default: {
      const _exhaustive: never = category
      void _exhaustive
      return null
    }
  }
}

export function getDisplayRating(row: PoiEntityRow, category: PoiCategory): number | null {
  switch (category) {
    case 'airbnb_listings':
      return num(row['rating_value'])
    case 'coffee_shops':
    case 'restaurants':
      return num(row['total_score'])
    case 'hotel_listings':
      return num(row['rating_value'])
    default:
      return null
  }
}

export function rowToFormValues(row: PoiEntityRow, category: PoiCategory): PoiCommonFormValues {
  const base: PoiCommonFormValues = {
    name: getDisplayName(row, category),
    address: getDisplayAddress(row, category),
    type: getDisplayType(row, category) ?? '',
  }
  if (category === 'educational_institutions') {
    base.institutionCode = str(row['institution_code'])
  }
  return base
}

/** POST body — map shared fields to physical columns per table (backend may also accept this shape). */
export function buildCreatePayload(
  category: PoiCategory,
  values: PoiCommonFormValues,
): Record<string, unknown> {
  const name = values.name.trim()
  const address = values.address.trim()
  const type = (values.type ?? '').trim()

  switch (category) {
    case 'airbnb_listings':
      return {
        title: name,
        location_subtitle: address || null,
      }
    case 'coffee_shops':
      return {
        title: name,
        street: address,
        category_name: type || null,
      }
    case 'restaurants':
      return {
        title: name,
        street: address,
        category_name: type || null,
      }
    case 'hotel_listings':
      return {
        name,
        location_fulladdress: address || null,
        type: type || null,
      }
    case 'matnasim':
      return {
        matnas_name: name,
        full_address: address || null,
      }
    case 'educational_institutions':
      return {
        institution_name: name,
        full_address: address || null,
        education_phase: type || null,
        institution_code: values.institutionCode?.trim() || '',
      }
    case 'synagogues':
      return {
        name,
        address,
        type: type || null,
      }
    default: {
      const _exhaustive: never = category
      void _exhaustive
      return {}
    }
  }
}

/** PATCH body — send fields your API expects (partial column updates). */
export function buildPatchPayload(
  category: PoiCategory,
  values: PoiCommonFormValues,
): Record<string, unknown> {
  return buildCreatePayload(category, values)
}
