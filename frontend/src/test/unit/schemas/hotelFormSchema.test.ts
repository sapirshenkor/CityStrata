import { describe, expect, it } from 'vitest'
import { formValuesToCreatePayload, hotelFormSchema } from '@/hotels_management/hotelFormSchema'

describe('hotelFormSchema', () => {
  it('accepts a valid hotel form payload', () => {
    const result = hotelFormSchema.safeParse({
      name: 'Hotel Eilat',
      location_fulladdress: '1 Herzl, Eilat',
      type: 'resort',
      description: 'Sea view',
      url: 'https://example.com/hotel',
      rating: '4.5',
    })

    expect(result.success).toBe(true)
  })

  it('requires name and address', () => {
    const result = hotelFormSchema.safeParse({
      name: '',
      location_fulladdress: '',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.message === 'יש להזין שם')).toBe(true)
    expect(result.error?.issues.some((issue) => issue.message === 'יש להזין כתובת')).toBe(true)
  })

  it('rejects invalid URLs and out-of-range ratings', () => {
    const invalidUrl = hotelFormSchema.safeParse({
      name: 'Hotel',
      location_fulladdress: 'Eilat',
      url: 'not-a-url',
    })
    const invalidRating = hotelFormSchema.safeParse({
      name: 'Hotel',
      location_fulladdress: 'Eilat',
      rating: '6',
    })

    expect(invalidUrl.success).toBe(false)
    expect(invalidUrl.error?.issues[0]?.message).toBe('יש להזין כתובת URL תקינה')

    expect(invalidRating.success).toBe(false)
    expect(invalidRating.error?.issues[0]?.message).toBe('הדירוג חייב להיות בין 0 ל-5')
  })
})

describe('formValuesToCreatePayload', () => {
  it('maps trimmed optional fields to API nulls and numeric rating_value', () => {
    expect(
      formValuesToCreatePayload({
        name: 'Hotel Eilat',
        location_fulladdress: 'Eilat',
        type: '  ',
        description: '  ',
        url: '  ',
        rating: '4',
      }),
    ).toEqual({
      name: 'Hotel Eilat',
      location_fulladdress: 'Eilat',
      type: null,
      description: null,
      url: null,
      rating_value: 4,
    })
  })
})
