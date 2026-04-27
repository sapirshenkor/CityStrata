import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1, 'שדה חובה')

const optionalNullableInt = z.preprocess((v) => {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return null
    return Number(t)
  }
  return v
}, z.number({ invalid_type_error: 'יש להזין מספר' }).int('יש להזין מספר שלם').min(0, 'לא ניתן להזין מספר שלילי').nullable())

const optionalNullableString = z.preprocess((v) => {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return null
    return t
  }
  return v
}, z.string().nullable())

const int0plus = z.coerce.number({ invalid_type_error: 'יש להזין מספר' }).int('יש להזין מספר שלם').min(0, 'לא ניתן להזין מספר שלילי')
const int1plus = z.coerce.number({ invalid_type_error: 'יש להזין מספר' }).int('יש להזין מספר שלם').min(1, 'יש להזין מספר גדול מ-0')

const importance1to5 = z.coerce.number({ invalid_type_error: 'יש להזין דירוג' }).int('יש להזין מספר שלם').min(1, 'הדירוג המינימלי הוא 1').max(5, 'הדירוג המקסימלי הוא 5')

export const evacueeFamilyProfileCreateSchema = z.object({
  // Contact Info
  family_name: nonEmptyString,
  contact_name: nonEmptyString,
  contact_phone: nonEmptyString,
  contact_email: z.string().trim().min(1, 'שדה חובה').email('כתובת דוא"ל לא תקינה'),
  home_stat_2022: optionalNullableInt,
  city_name: nonEmptyString,
  home_address: nonEmptyString,

  // Family Composition
  total_people: int1plus,
  infants: int0plus,
  preschool: int0plus,
  elementary: int0plus,
  youth: int0plus,
  adults: int0plus,
  seniors: int0plus,
  has_mobility_disability: z.boolean(),
  has_car: z.boolean(),

  // Education
  essential_education: z.array(nonEmptyString).optional().default([]),
  education_proximity_importance: importance1to5,

  // Religious/Cultural
  religious_affiliation: z.enum(['secular', 'traditional', 'religious', 'haredi', 'other']),
  needs_synagogue: z.boolean(),
  culture_frequency: z.enum(['daily', 'weekly', 'rarely']),

  // Community
  matnas_participation: z.boolean(),
  social_venues_importance: importance1to5,
  needs_community_proximity: z.boolean(),

  // Housing
  accommodation_preference: z.enum(['airbnb', 'hotel']),
  estimated_stay_duration: optionalNullableString,

  // Extra
  needs_medical_proximity: z.boolean(),
  services_importance: importance1to5,
  notes: optionalNullableString,
})

export const stepSchemas = {
  step1: evacueeFamilyProfileCreateSchema.pick({
    family_name: true,
    contact_name: true,
    contact_phone: true,
    contact_email: true,
    home_stat_2022: true,
    city_name: true,
    home_address: true,
  }),
  step2: evacueeFamilyProfileCreateSchema.pick({
    total_people: true,
    infants: true,
    preschool: true,
    elementary: true,
    youth: true,
    adults: true,
    seniors: true,
    has_mobility_disability: true,
    has_car: true,
  }),
  step3: evacueeFamilyProfileCreateSchema.pick({
    essential_education: true,
    education_proximity_importance: true,
  }),
  step4: evacueeFamilyProfileCreateSchema.pick({
    religious_affiliation: true,
    needs_synagogue: true,
    culture_frequency: true,
  }),
  step5: evacueeFamilyProfileCreateSchema.pick({
    matnas_participation: true,
    social_venues_importance: true,
    needs_community_proximity: true,
  }),
  step6: evacueeFamilyProfileCreateSchema.pick({
    accommodation_preference: true,
    estimated_stay_duration: true,
  }),
  step7: evacueeFamilyProfileCreateSchema.pick({
    needs_medical_proximity: true,
    services_importance: true,
    notes: true,
  }),
}

export function formatZodErrors(zodError) {
  const out = {}
  for (const issue of zodError.issues) {
    const key = issue.path?.[0]
    if (typeof key === 'string' && !out[key]) out[key] = issue.message
  }
  return out
}

export function toPayload(data) {
  return {
    family_name: data.family_name,
    contact_name: data.contact_name,
    contact_phone: data.contact_phone,
    contact_email: data.contact_email,
    home_stat_2022: data.home_stat_2022 ?? null,
    city_name: data.city_name,
    home_address: data.home_address,

    total_people: data.total_people,
    infants: data.infants,
    preschool: data.preschool,
    elementary: data.elementary,
    youth: data.youth,
    adults: data.adults,
    seniors: data.seniors,
    has_mobility_disability: data.has_mobility_disability,
    has_car: data.has_car,

    essential_education: data.essential_education ?? [],
    education_proximity_importance: data.education_proximity_importance,

    religious_affiliation: data.religious_affiliation,
    needs_synagogue: data.needs_synagogue,
    culture_frequency: data.culture_frequency,

    matnas_participation: data.matnas_participation,
    social_venues_importance: data.social_venues_importance,
    needs_community_proximity: data.needs_community_proximity,

    accommodation_preference: data.accommodation_preference,
    estimated_stay_duration:
      data.estimated_stay_duration && data.estimated_stay_duration.trim()
        ? data.estimated_stay_duration.trim()
        : null,

    needs_medical_proximity: data.needs_medical_proximity,
    services_importance: data.services_importance,
    notes: data.notes && data.notes.trim() ? data.notes.trim() : null,
  }
}