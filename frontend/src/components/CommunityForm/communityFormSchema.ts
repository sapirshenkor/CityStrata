import { z } from 'zod'

export const COMMUNITY_TYPES = [
  { value: 'neighborhood', label: 'שכונה' },
  { value: 'religious', label: 'קהילה דתית' },
  { value: 'kibbutz_moshav', label: 'קיבוץ / מושב' },
  { value: 'interest_group', label: 'קבוצת עניין' },
] as const

export const HOUSING_PREFERENCES = [
  { value: 'hotel', label: 'מלון' },
  { value: 'scattered_apartments', label: 'דירות מפוזרות' },
] as const

export const communityFormSchema = z.object({
  community_name: z.string().trim().min(1, 'נא להזין שם קהילה'),
  leader_name: z.string().trim().min(1, 'נא להזין שם איש קשר'),
  contact_phone: z.string().trim().min(3, 'נא להזין מספר טלפון'),
  contact_email: z.string().trim().min(1, 'נא להזין אימייל').email('כתובת אימייל לא תקינה'),

  community_type: z.enum(['neighborhood', 'religious', 'kibbutz_moshav', 'interest_group'], {
    message: 'נא לבחור סוג קהילה',
  }),

  total_families: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר משפחות' })
    .int('מספר שלם בלבד')
    .min(0, 'מספר משפחות לא יכול להיות שלילי'),

  total_people: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר נפשות' })
    .int('מספר שלם בלבד')
    .min(1, 'מספר נפשות חייב להיות לפחות 1'),

  infants: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר' })
    .int('מספר שלם בלבד')
    .min(0, 'לא שלילי'),
  preschool: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר' })
    .int('מספר שלם בלבד')
    .min(0, 'לא שלילי'),
  elementary: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר' })
    .int('מספר שלם בלבד')
    .min(0, 'לא שלילי'),
  youth: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר' })
    .int('מספר שלם בלבד')
    .min(0, 'לא שלילי'),
  adults: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר' })
    .int('מספר שלם בלבד')
    .min(0, 'לא שלילי'),
  seniors: z.coerce
    .number({ invalid_type_error: 'נא להזין מספר' })
    .int('מספר שלם בלבד')
    .min(0, 'לא שלילי'),

  cohesion_importance: z.coerce
    .number({ invalid_type_error: 'נא לבחור דירוג בין 1 ל־5' })
    .int('מספר שלם בלבד')
    .min(1, 'דירוג מינימלי 1')
    .max(5, 'דירוג מקסימלי 5'),

  housing_preference: z.enum(['hotel', 'scattered_apartments'], {
    message: 'נא לבחור העדפת מגורים',
  }),

  needs_synagogue: z.boolean(),
  needs_community_center: z.boolean(),
  needs_education_institution: z.boolean(),

  infrastructure_notes: z.string().optional(),
})
  .superRefine((data, ctx) => {
    const sum =
      data.infants +
      data.preschool +
      data.elementary +
      data.youth +
      data.adults +
      data.seniors
    if (sum !== data.total_people) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'סכום קטגוריות הגיל חייב להיות שווה למספר נפשות',
        path: ['total_people'],
      })
    }
  })

export type CommunityFormValues = z.infer<typeof communityFormSchema>

export function communityFormValuesToPayload(values: CommunityFormValues) {
  const notes = values.infrastructure_notes?.trim()
  return {
    community_name: values.community_name.trim(),
    leader_name: values.leader_name.trim(),
    contact_phone: values.contact_phone.trim(),
    contact_email: values.contact_email.trim(),
    total_families: values.total_families,
    total_people: values.total_people,
    infants: values.infants,
    preschool: values.preschool,
    elementary: values.elementary,
    youth: values.youth,
    adults: values.adults,
    seniors: values.seniors,
    community_type: values.community_type,
    cohesion_importance: values.cohesion_importance,
    housing_preference: values.housing_preference,
    needs_synagogue: values.needs_synagogue,
    needs_community_center: values.needs_community_center,
    needs_education_institution: values.needs_education_institution,
    infrastructure_notes: notes ? notes : null,
  }
}
