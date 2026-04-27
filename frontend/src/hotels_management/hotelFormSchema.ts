import { z } from 'zod'

export const hotelFormSchema = z.object({
  name: z.string().trim().min(1, 'יש להזין שם'),
  location_fulladdress: z.string().trim().min(1, 'יש להזין כתובת'),
  type: z.string().optional(),
  description: z.string().optional(),
  url: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.trim() === '' || /^https?:\/\/.+/i.test(v.trim()),
      'יש להזין כתובת URL תקינה',
    ),
  /** Raw input from `<input type="number" />` — parsed in `formValuesToCreatePayload` */
  rating: z
    .string()
    .optional()
    .refine(
      (s) => {
        if (s === undefined || s.trim() === '') return true
        const n = Number(s)
        return !Number.isNaN(n) && n >= 0 && n <= 5
      },
      { message: 'הדירוג חייב להיות בין 0 ל-5' },
    ),
})

export type HotelFormValues = z.infer<typeof hotelFormSchema>

export function formValuesToCreatePayload(values: HotelFormValues) {
  const url = values.url?.trim()
  const rt = values.rating?.trim()
  let rating_value: number | null = null
  if (rt) {
    const n = Number(rt)
    if (!Number.isNaN(n)) rating_value = n
  }
  return {
    name: values.name,
    location_fulladdress: values.location_fulladdress,
    type: values.type?.trim() || null,
    description: values.description?.trim() || null,
    url: url || null,
    rating_value,
  }
}
