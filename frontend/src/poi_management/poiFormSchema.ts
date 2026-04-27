import { z } from 'zod'
import type { PoiCategory } from './types'

const baseFields = {
  name: z.string().trim().min(1, 'יש להזין שם'),
  address: z.string().trim().min(1, 'יש להזין כתובת'),
  type: z.string().optional(),
}

/** Empty number input → undefined; otherwise 0–5 */
const ratingScoreOptional = z
  .union([z.number(), z.nan()])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v))
  .pipe(
    z
      .number()
      .min(0, 'הדירוג חייב להיות לפחות 0')
      .max(5, 'הדירוג חייב להיות עד 5')
      .optional(),
  )

const hotelOptional = {
  description: z.string().optional(),
  url: z.string().optional(),
  ratingValue: ratingScoreOptional,
}

const optionalIntNonNegative = z
  .union([z.number(), z.nan()])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v))
  .pipe(z.number().int().min(0).optional())

const optionalNonNegativeFloat = z
  .union([z.number(), z.nan()])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v))
  .pipe(z.number().min(0).optional())

const airbnbFields = {
  name: z.string().trim().min(1, 'יש להזין כותרת'),
  address: z.string().trim().min(1, 'יש להזין מיקום'),
  description: z.string().optional(),
  url: z.string().optional(),
  numNights: optionalIntNonNegative,
  pricePerNight: optionalNonNegativeFloat,
  personCapacity: optionalIntNonNegative,
  ratingValue: ratingScoreOptional,
  institutionCode: z.string().optional(),
}

const educationFields = {
  institutionCode: z.string().trim().min(1, 'יש להזין קוד מוסד'),
  name: z.string().trim().min(1, 'יש להזין שם מוסד'),
  address: z.string().trim().min(1, 'יש להזין כתובת מלאה'),
  typeOfSupervision: z.string().optional(),
  typeOfEducation: z.string().optional(),
  educationPhase: z.string().optional(),
}

export function getPoiFormSchema(category: PoiCategory) {
  if (category === 'educational_institutions') {
    return z.object(educationFields)
  }
  if (category === 'hotel_listings') {
    return z.object({
      ...baseFields,
      institutionCode: z.string().optional(),
      ...hotelOptional,
    })
  }
  if (category === 'airbnb_listings') {
    return z.object(airbnbFields)
  }
  if (category === 'coffee_shops') {
    return z.object({
      name: z.string().trim().min(1, 'יש להזין כותרת'),
      address: z.string().trim().min(1, 'יש להזין רחוב'),
      type: z.string().optional(),
      description: z.string().optional(),
      url: z.string().optional(),
      website: z.string().optional(),
      ratingValue: ratingScoreOptional,
      activityTimesJson: z
        .string()
        .optional()
        .refine(
          (val) => {
            if (val == null || !String(val).trim()) return true
            try {
              JSON.parse(String(val).trim())
              return true
            } catch {
              return false
            }
          },
          { message: 'שעות הפעילות חייבות להיות JSON תקין או ריקות' },
        ),
      institutionCode: z.string().optional(),
    })
  }
  if (category === 'restaurants') {
    return z.object({
      name: z.string().trim().min(1, 'יש להזין כותרת'),
      address: z.string().trim().min(1, 'יש להזין רחוב'),
      type: z.string().optional(),
      description: z.string().optional(),
      url: z.string().optional(),
      website: z.string().optional(),
      ratingValue: ratingScoreOptional,
      institutionCode: z.string().optional(),
    })
  }
  if (category === 'matnasim') {
    return z.object({
      name: z.string().trim().min(1, 'יש להזין שם מרכז'),
      address: z.string().trim().min(1, 'יש להזין כתובת מלאה'),
      personInCharge: z.string().optional(),
      phoneNumber: z.string().optional(),
      activityDays: z.string().optional(),
      facilityArea: optionalIntNonNegative,
      occupancy: optionalIntNonNegative,
      numberOfActivityRooms: z.string().optional(),
      shelterAndWhere: z.string().optional(),
      type: z.string().optional(),
      institutionCode: z.string().optional(),
    })
  }
  if (category === 'synagogues') {
    return z
      .object({
        name: z.string(),
        nameHe: z.string(),
        address: z.string().trim().min(1, 'יש להזין כתובת'),
        type: z.string(),
        typeHe: z.string(),
        institutionCode: z.string().optional(),
      })
      .refine((d) => !!(d.name.trim() || d.nameHe.trim()), {
        message: 'יש להזין שם בעברית או באנגלית',
        path: ['name'],
      })
      .refine((d) => !!(d.type.trim() || d.typeHe.trim()), {
        message: 'יש להזין סוג בעברית או באנגלית',
        path: ['type'],
      })
  }
  return z.object({
    ...baseFields,
    institutionCode: z.string().optional(),
  })
}

export type PoiFormSchema = ReturnType<typeof getPoiFormSchema>
