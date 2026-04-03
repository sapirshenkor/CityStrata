import type { PoiCategory } from './types'

/** UI copy and field labels aligned with DB column names per category. */
export interface PoiFormFieldConfig {
  /** Short noun phrase for dialog titles, e.g. "Airbnb listing", "Coffee shop" */
  addRecordTitle: string
  /** Subtitle under the dialog title */
  dialogDescription: string
  nameLabel: string
  namePlaceholder: string
  addressLabel: string
  addressPlaceholder: string
  /** Shown under address for geocoding-backed categories */
  addressHint?: string
  typeField: false | { label: string; placeholder: string }
  /** Shown under optional rating input when present */
  ratingHint?: string
}

const GEOCODE_HINT =
  'Used for geocoding — use a full address the server can resolve (city, street).'

export const POI_FORM_FIELD_CONFIG: Record<PoiCategory, PoiFormFieldConfig> = {
  airbnb_listings: {
    addRecordTitle: 'Airbnb listing',
    dialogDescription:
      'Fields map to title, url, description, num_nights, price_per_night, rating_value, person_capacity, and location_subtitle. Coordinates are set when the server geocodes the address.',
    nameLabel: 'Title',
    namePlaceholder: 'Listing title (title)',
    addressLabel: 'Location / subtitle',
    addressPlaceholder: 'Area or address line (location_subtitle)',
    addressHint:
      'Shown as the listing location line. Coordinates are set when the server geocodes this.',
    typeField: false,
  },
  coffee_shops: {
    addRecordTitle: 'Coffee shop',
    dialogDescription:
      'Maps to title, description, category_name, total_score, url, website, street, activity_times (JSON). Street is geocoded for coordinates.',
    nameLabel: 'Title',
    namePlaceholder: 'Venue title',
    addressLabel: 'Street address',
    addressPlaceholder: 'Street, city (street)',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  restaurants: {
    addRecordTitle: 'Restaurant',
    dialogDescription:
      'title, description, category_name, total_score, url, website, street (geocoded for location).',
    nameLabel: 'Title',
    namePlaceholder: 'Restaurant title',
    addressLabel: 'Street (location)',
    addressPlaceholder: 'Street, city (street)',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  hotel_listings: {
    addRecordTitle: 'Hotel',
    dialogDescription:
      'url, name, description, type, rating_value, location_fulladdress. Full address is geocoded on create.',
    nameLabel: 'Hotel name',
    namePlaceholder: 'Property name (name)',
    addressLabel: 'Full address',
    addressPlaceholder: 'Full address for geocoding (location_fulladdress)',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  matnasim: {
    addRecordTitle: 'Matnas',
    dialogDescription:
      'matnas_name, full_address, person_in_charge, phone_number, activity_days, facility_area, occupancy, number_of_activity_rooms, shelter_and_where. Address is geocoded.',
    nameLabel: 'Center name',
    namePlaceholder: 'Community center name (matnas_name)',
    addressLabel: 'Full address',
    addressPlaceholder: 'Street and city (full_address)',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  educational_institutions: {
    addRecordTitle: 'Institution',
    dialogDescription:
      'institution_code, institution_name, full_address, type_of_supervision, type_of_education, education_phase. Address is geocoded for coordinates.',
    nameLabel: 'Institution name',
    namePlaceholder: 'School or institution (institution_name)',
    addressLabel: 'Full address',
    addressPlaceholder: 'Street and city (full_address)',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
  synagogues: {
    addRecordTitle: 'Synagogue',
    dialogDescription:
      'name, name_he (at least one), type, type_he (at least one), address. Address is geocoded on create.',
    nameLabel: 'Name',
    namePlaceholder: 'English name (name)',
    addressLabel: 'Address',
    addressPlaceholder: 'Street address (address)',
    addressHint: GEOCODE_HINT,
    typeField: false,
  },
}

export function getPoiFormFieldConfig(category: PoiCategory): PoiFormFieldConfig {
  return POI_FORM_FIELD_CONFIG[category]
}
