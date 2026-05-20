import { describe, expect, it } from 'vitest'
import { formatQueryError } from '@/lib/formatQueryError'

describe('formatQueryError', () => {
  it('returns FastAPI string detail from axios-like errors', () => {
    const err = {
      response: {
        data: { detail: 'אין הרשאה' },
      },
    }

    expect(formatQueryError(err)).toBe('אין הרשאה')
  })

  it('joins FastAPI validation detail arrays', () => {
    const err = {
      response: {
        data: {
          detail: [{ msg: 'שדה חובה' }, { msg: 'ערך לא תקין' }],
        },
      },
    }

    expect(formatQueryError(err)).toContain('שדה חובה')
    expect(formatQueryError(err)).toContain('ערך לא תקין')
  })

  it('returns Error.message for plain Error instances', () => {
    expect(formatQueryError(new Error('Network Error'))).toBe('Network Error')
  })

  it('falls back to the Hebrew default message for unknown errors', () => {
    expect(formatQueryError(null)).toBe('אירעה שגיאה. נסו שוב.')
    expect(formatQueryError({ foo: 'bar' })).toBe('אירעה שגיאה. נסו שוב.')
  })
})
