import { describe, expect, it } from 'vitest'
import {
  evacueeFamilyProfileCreateSchema,
  formatZodErrors,
  stepSchemas,
  toPayload,
} from '@/components/EvacueeProfileForm/evacueeFamilyProfileSchemas'

const validProfile = {
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
  estimated_stay_duration: '',
  needs_medical_proximity: false,
  services_importance: 4,
  notes: '  ',
}

describe('evacueeFamilyProfileCreateSchema', () => {
  it('accepts a complete valid evacuee profile', () => {
    expect(evacueeFamilyProfileCreateSchema.safeParse(validProfile).success).toBe(true)
  })

  it('rejects missing required contact fields with Hebrew messages', () => {
    const result = evacueeFamilyProfileCreateSchema.safeParse({
      ...validProfile,
      contact_email: 'invalid-email',
      family_name: '',
    })

    expect(result.success).toBe(false)
    expect(result.error.issues.some((issue) => issue.message === 'שדה חובה')).toBe(true)
    expect(result.error.issues.some((issue) => issue.message === 'כתובת דוא"ל לא תקינה')).toBe(
      true,
    )
  })

  it('enforces importance ratings between 1 and 5', () => {
    const result = evacueeFamilyProfileCreateSchema.safeParse({
      ...validProfile,
      education_proximity_importance: 6,
    })

    expect(result.success).toBe(false)
    expect(result.error.issues.some((issue) => issue.message === 'הדירוג המקסימלי הוא 5')).toBe(
      true,
    )
  })

  it('coerces blank optional numeric fields to null', () => {
    const result = evacueeFamilyProfileCreateSchema.safeParse({
      ...validProfile,
      home_stat_2022: '',
    })

    expect(result.success).toBe(true)
    expect(result.data.home_stat_2022).toBeNull()
  })
})

describe('stepSchemas', () => {
  it('validates only step 1 contact fields during the wizard first step', () => {
    const validStep1 = stepSchemas.step1.safeParse({
      family_name: validProfile.family_name,
      contact_name: validProfile.contact_name,
      contact_phone: validProfile.contact_phone,
      contact_email: validProfile.contact_email,
      home_stat_2022: validProfile.home_stat_2022,
      city_name: validProfile.city_name,
      home_address: validProfile.home_address,
    })
    const invalidStep1 = stepSchemas.step1.safeParse({
      ...validProfile,
      contact_email: 'bad-email',
    })

    expect(validStep1.success).toBe(true)
    expect(invalidStep1.success).toBe(false)
  })
})

describe('formatZodErrors', () => {
  it('maps the first issue per field to a flat error object', () => {
    const parsed = stepSchemas.step1.safeParse({
      family_name: '',
      contact_name: '',
      contact_phone: '',
      contact_email: 'bad',
      home_stat_2022: null,
      city_name: '',
      home_address: '',
    })

    expect(parsed.success).toBe(false)
    expect(formatZodErrors(parsed.error)).toMatchObject({
      family_name: 'שדה חובה',
      contact_email: 'כתובת דוא"ל לא תקינה',
    })
  })
})

describe('toPayload', () => {
  it('normalizes optional strings to null for API submission', () => {
    expect(toPayload(validProfile)).toMatchObject({
      family_name: 'Cohen',
      home_stat_2022: 100,
      estimated_stay_duration: null,
      notes: null,
      essential_education: ['kindergarten'],
    })
  })
})
