import { describe, expect, it } from 'vitest'
import { loginFormSchema, signupFormSchema, toSignupPayload } from '@/lib/authFormSchemas'

describe('loginFormSchema', () => {
  it('accepts a valid login payload', () => {
    const result = loginFormSchema.safeParse({
      email: 'user@municipality.gov.il',
      password: 'password123',
    })

    expect(result.success).toBe(true)
  })

  it('requires email and enforces minimum password length', () => {
    const missingEmail = loginFormSchema.safeParse({ email: '', password: 'password123' })
    const shortPassword = loginFormSchema.safeParse({
      email: 'user@municipality.gov.il',
      password: 'short',
    })

    expect(missingEmail.success).toBe(false)
    expect(missingEmail.error?.issues[0]?.message).toBe('שדה חובה')

    expect(shortPassword.success).toBe(false)
    expect(shortPassword.error?.issues[0]?.message).toBe('לפחות 8 תווים')
  })

  it('rejects invalid email format with the Hebrew validation message', () => {
    const result = loginFormSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.message === 'כתובת דוא"ל לא תקינה')).toBe(
      true,
    )
  })
})

describe('signupFormSchema', () => {
  it('accepts a valid signup payload', () => {
    const result = signupFormSchema.safeParse({
      first_name: 'Dana',
      last_name: 'Cohen',
      email: 'dana@example.com',
      phone: '0501234567',
      department: 'Education',
      password: 'password123',
    })

    expect(result.success).toBe(true)
  })

  it('requires core identity fields', () => {
    const result = signupFormSchema.safeParse({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      department: '',
      password: 'password123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.filter((issue) => issue.message === 'שדה חובה').length).toBeGreaterThan(
      0,
    )
  })
})

describe('toSignupPayload', () => {
  it('maps optional phone and department to backend contract shapes', () => {
    expect(
      toSignupPayload({
        first_name: 'Dana',
        last_name: 'Cohen',
        email: 'dana@example.com',
        phone: '  ',
        department: '  ',
        password: 'password123',
      }),
    ).toEqual({
      email: 'dana@example.com',
      password: 'password123',
      first_name: 'Dana',
      last_name: 'Cohen',
      phone_number: '',
      department: null,
    })
  })
})
