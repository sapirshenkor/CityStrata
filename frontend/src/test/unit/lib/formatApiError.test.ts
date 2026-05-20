import { describe, expect, it } from 'vitest'
import { formatApiError } from '@/lib/formatApiError'

describe('formatApiError', () => {
  it('extracts FastAPI string detail from axios errors', () => {
    const err = {
      response: {
        status: 401,
        data: { detail: 'Invalid email or password' },
      },
      message: 'Request failed with status code 401',
    }

    expect(formatApiError(err)).toBe('Invalid email or password')
  })

  it('joins FastAPI validation detail arrays into a readable message', () => {
    const err = {
      response: {
        status: 422,
        data: {
          detail: [{ msg: 'שדה חובה' }, { msg: 'כתובת דוא"ל לא תקינה' }],
        },
      },
    }

    expect(formatApiError(err)).toBe('שדה חובה כתובת דוא"ל לא תקינה')
  })

  it('preserves network-level axios messages when no HTTP response exists', () => {
    expect(formatApiError({ message: 'Network Error' })).toBe('Network Error')
  })
})
