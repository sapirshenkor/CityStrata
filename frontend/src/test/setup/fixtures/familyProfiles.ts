/**
 * Family profile fixtures aligned with backend/tests/helpers/factories.py
 * evacuee_profile_db_row and create profile payloads.
 */

export function makeFamilyProfileCreatePayload(
  overrides: Record<string, unknown> = {},
) {
  return {
    family_name: 'Cohen',
    contact_name: 'Dana Cohen',
    contact_phone: '0501234567',
    contact_email: 'dana@example.com',
    home_stat_2022: 100,
    city_name: 'Eilat',
    home_address: '1 Herzl St',
    total_people: 4,
    infants: 0,
    preschool: 1,
    elementary: 1,
    youth: 0,
    adults: 2,
    seniors: 0,
    has_mobility_disability: false,
    has_car: true,
    essential_education: ['kindergarten'],
    education_proximity_importance: 4,
    religious_affiliation: 'traditional',
    needs_synagogue: true,
    culture_frequency: 'rarely',
    matnas_participation: false,
    social_venues_importance: 3,
    needs_community_proximity: false,
    accommodation_preference: 'airbnb',
    estimated_stay_duration: null,
    needs_medical_proximity: false,
    services_importance: 4,
    notes: null,
    ...overrides,
  }
}

export function makeFamilyProfileResponse(
  overrides: Record<string, unknown> = {},
) {
  return {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    family_name: 'Cohen',
    contact_name: 'Dana Cohen',
    contact_phone: '0501234567',
    contact_email: 'dana@example.com',
    home_stat_2022: 100,
    city_name: 'Eilat',
    home_address: '1 Herzl St',
    total_people: 4,
    infants: 0,
    preschool: 1,
    elementary: 1,
    youth: 0,
    adults: 2,
    seniors: 0,
    has_mobility_disability: false,
    has_car: true,
    essential_education: ['kindergarten'],
    education_proximity_importance: 4,
    religious_affiliation: 'traditional',
    needs_synagogue: true,
    culture_frequency: 'rarely',
    matnas_participation: false,
    social_venues_importance: 3,
    needs_community_proximity: false,
    accommodation_preference: 'airbnb',
    estimated_stay_duration: null,
    needs_medical_proximity: false,
    services_importance: 4,
    notes: null,
    ...overrides,
  }
}
