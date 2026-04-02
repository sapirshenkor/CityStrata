import { z } from 'zod'
import type { PoiCategory } from './types'

const baseFields = {
  name: z.string().trim().min(1, 'Name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  type: z.string().optional(),
}

export function getPoiFormSchema(category: PoiCategory) {
  if (category === 'educational_institutions') {
    return z.object({
      ...baseFields,
      institutionCode: z.string().trim().min(1, 'Institution code is required'),
    })
  }
  return z.object({
    ...baseFields,
    institutionCode: z.string().optional(),
  })
}

export type PoiFormSchema = ReturnType<typeof getPoiFormSchema>
