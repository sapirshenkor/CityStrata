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
      return str(row['name']) || str(row['name_he'])
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
      return str(row['type']) || str(row['type_he']) || null
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
    base.name = str(row['institution_name'])
    base.address = str(row['full_address'] || row['address'])
    base.typeOfSupervision = str(row['type_of_supervision']) || ''
    base.typeOfEducation = str(row['type_of_education']) || ''
    base.educationPhase = str(row['education_phase']) || ''
    base.type = ''
  }
  if (category === 'hotel_listings') {
    base.description = str(row['description']) || undefined
    base.url = str(row['url']) || undefined
    const rv = num(row['rating_value'])
    base.ratingValue = rv ?? undefined
  }
  if (category === 'airbnb_listings') {
    base.description = str(row['description']) || undefined
    base.url = str(row['url']) || undefined
    base.numNights = num(row['num_nights']) ?? undefined
    base.pricePerNight = num(row['price_per_night']) ?? undefined
    base.personCapacity = num(row['person_capacity']) ?? undefined
    const rv = num(row['rating_value'])
    base.ratingValue = rv ?? undefined
  }
  if (category === 'coffee_shops') {
    base.description = str(row['description']) || undefined
    base.url = str(row['url']) || undefined
    base.website = str(row['website']) || undefined
    const at = row['activity_times']
    if (at != null) {
      try {
        base.activityTimesJson =
          typeof at === 'string' ? at : JSON.stringify(at, null, 2)
      } catch {
        base.activityTimesJson = String(at)
      }
    } else {
      base.activityTimesJson = ''
    }
    const rv = num(row['total_score'])
    base.ratingValue = rv ?? undefined
  }
  if (category === 'restaurants') {
    base.description = str(row['description']) || undefined
    base.url = str(row['url']) || undefined
    base.website = str(row['website']) || undefined
    const rv = num(row['total_score'])
    base.ratingValue = rv ?? undefined
  }
  if (category === 'matnasim') {
    base.name = str(row['matnas_name'])
    base.address = str(row['full_address'])
    base.personInCharge = str(row['person_in_charge']) || ''
    base.phoneNumber = str(row['phone_number']) || ''
    base.activityDays = str(row['activity_days']) || ''
    base.facilityArea = num(row['facility_area']) ?? undefined
    base.occupancy = num(row['occupancy']) ?? undefined
    base.numberOfActivityRooms = str(row['number_of_activity_rooms']) || ''
    base.shelterAndWhere = str(row['shelter_and_where']) || ''
    base.type = ''
  }
  if (category === 'synagogues') {
    base.name = str(row['name'])
    base.nameHe = str(row['name_he'])
    base.type = str(row['type'])
    base.typeHe = str(row['type_he'])
    base.address = str(row['address'])
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
    case 'airbnb_listings': {
      const payload: Record<string, unknown> = {
        title: name,
        url: values.url?.trim() || null,
        description: values.description?.trim() || null,
        location_subtitle: address || null,
      }
      if (values.numNights != null) {
        payload.num_nights = values.numNights
      }
      if (values.pricePerNight != null) {
        payload.price_per_night = values.pricePerNight
      }
      if (values.ratingValue != null) {
        payload.rating_value = values.ratingValue
      }
      if (values.personCapacity != null) {
        payload.person_capacity = values.personCapacity
      }
      return payload
    }
    case 'coffee_shops': {
      let activity_times: unknown = null
      const rawJson = values.activityTimesJson?.trim()
      if (rawJson) {
        try {
          activity_times = JSON.parse(rawJson)
        } catch {
          /* zod validates */
        }
      }
      const payload: Record<string, unknown> = {
        title: name,
        description: values.description?.trim() || null,
        category_name: type || null,
        street: address,
        url: values.url?.trim() || null,
        website: values.website?.trim() || null,
        activity_times,
      }
      if (values.ratingValue != null) {
        payload.total_score = values.ratingValue
      }
      return payload
    }
    case 'restaurants': {
      const payload: Record<string, unknown> = {
        title: name,
        description: values.description?.trim() || null,
        category_name: type || null,
        street: address,
        url: values.url?.trim() || null,
        website: values.website?.trim() || null,
      }
      if (values.ratingValue != null) {
        payload.total_score = values.ratingValue
      }
      return payload
    }
    case 'hotel_listings': {
      const payload: Record<string, unknown> = {
        name,
        location_fulladdress: address,
        type: type || null,
        description: values.description?.trim() || null,
        url: values.url?.trim() || null,
      }
      if (values.ratingValue != null) {
        payload.rating_value = values.ratingValue
      }
      return payload
    }
    case 'matnasim':
      return {
        matnas_name: name,
        full_address: address || null,
        person_in_charge: values.personInCharge?.trim() || null,
        phone_number: values.phoneNumber?.trim() || null,
        activity_days: values.activityDays?.trim() || null,
        facility_area: values.facilityArea ?? null,
        occupancy: values.occupancy ?? null,
        number_of_activity_rooms: values.numberOfActivityRooms?.trim() || null,
        shelter_and_where: values.shelterAndWhere?.trim() || null,
      }
    case 'educational_institutions':
      return {
        institution_code: values.institutionCode?.trim() || '',
        institution_name: name,
        full_address: address || null,
        type_of_supervision: values.typeOfSupervision?.trim() || null,
        type_of_education: values.typeOfEducation?.trim() || null,
        education_phase: values.educationPhase?.trim() || null,
      }
    case 'synagogues':
      return {
        name: name || null,
        name_he: values.nameHe?.trim() || null,
        address,
        type: type || null,
        type_he: values.typeHe?.trim() || null,
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
