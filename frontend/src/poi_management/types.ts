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
  /** hotel_listings — HotelCreate.description; airbnb_listings / coffee_shops / restaurants — description */
  description?: string
  /** hotel_listings — HotelCreate.url; airbnb_listings / coffee_shops / restaurants — url */
  url?: string
  /** hotel_listings → rating_value; airbnb_listings → rating_value; coffee_shops / restaurants → total_score */
  ratingValue?: number | null
  /** airbnb_listings — num_nights */
  numNights?: number | null
  /** airbnb_listings — price_per_night */
  pricePerNight?: number | null
  /** airbnb_listings — person_capacity */
  personCapacity?: number | null
  /** coffee_shops / restaurants — website (distinct from url) */
  website?: string
  /** coffee_shops — activity_times JSONB, edited as JSON text */
  activityTimesJson?: string
  /** educational_institutions — type_of_supervision */
  typeOfSupervision?: string
  /** educational_institutions — type_of_education */
  typeOfEducation?: string
  /** educational_institutions — education_phase */
  educationPhase?: string
  /** matnasim — person_in_charge */
  personInCharge?: string
  /** matnasim — phone_number */
  phoneNumber?: string
  /** matnasim — activity_days */
  activityDays?: string
  /** matnasim — facility_area */
  facilityArea?: number | null
  /** matnasim — occupancy */
  occupancy?: number | null
  /** matnasim — number_of_activity_rooms */
  numberOfActivityRooms?: string
  /** matnasim — shelter_and_where */
  shelterAndWhere?: string
  /** synagogues — name_he (at least one of name / name_he required) */
  nameHe?: string
  /** synagogues — type_he (at least one of type / type_he required) */
  typeHe?: string
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
