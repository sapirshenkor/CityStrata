import { describe, expect, it } from 'vitest'
import { getPoiFormSchema } from '@/poi_management/poiFormSchema'

describe('getPoiFormSchema', () => {
  it('validates educational institution required fields', () => {
    const schema = getPoiFormSchema('educational_institutions')

    expect(
      schema.safeParse({
        institutionCode: '12345',
        name: 'Elementary School',
        address: '1 Education St',
      }).success,
    ).toBe(true)

    const invalid = schema.safeParse({
      institutionCode: '',
      name: '',
      address: '',
    })

    expect(invalid.success).toBe(false)
    expect(invalid.error?.issues.some((issue) => issue.message === 'יש להזין קוד מוסד')).toBe(true)
  })

  it('validates coffee shop activityTimesJson as optional JSON', () => {
    const schema = getPoiFormSchema('coffee_shops')

    expect(
      schema.safeParse({
        name: 'Coffee Corner',
        address: 'Main Street',
        activityTimesJson: '{"sun":"09:00-17:00"}',
      }).success,
    ).toBe(true)

    const invalid = schema.safeParse({
      name: 'Coffee Corner',
      address: 'Main Street',
      activityTimesJson: '{invalid json',
    })

    expect(invalid.success).toBe(false)
    expect(invalid.error?.issues[0]?.message).toBe('שעות הפעילות חייבות להיות JSON תקין או ריקות')
  })

  it('requires synagogue name and type in Hebrew or English', () => {
    const schema = getPoiFormSchema('synagogues')

    expect(
      schema.safeParse({
        name: '',
        nameHe: 'בית כנסת',
        address: '1 Synagogue Lane',
        type: '',
        typeHe: 'אשכנז',
      }).success,
    ).toBe(true)

    const invalid = schema.safeParse({
      name: '',
      nameHe: '',
      address: '1 Synagogue Lane',
      type: '',
      typeHe: '',
    })

    expect(invalid.success).toBe(false)
    expect(invalid.error?.issues.some((issue) => issue.message.includes('שם'))).toBe(true)
  })
})
