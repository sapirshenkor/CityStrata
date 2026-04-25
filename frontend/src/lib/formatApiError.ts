/**
 * Maps API / network errors to a user-visible string.
 * Supports FastAPI-style `detail` (string or validation array), alternate `message` / `error` shapes,
 * and JSON provided as a string in `response.data` (some clients or transforms leave it unparsed).
 *
 * When there is no HTTP response (offline, CORS layer, connection reset), falls back to Axios
 * `message` (typically "Network Error") so real network failures stay distinguishable.
 */
function tryParseJson(value: string): unknown {
  const t = value.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return value
  try {
    return JSON.parse(t) as unknown
  } catch {
    return value
  }
}

/** Normalize axios `response.data` to a plain object we can read `detail` / `message` from. */
function normalizeData(data: unknown): unknown {
  if (data == null) return null
  if (typeof data === 'string') {
    return tryParseJson(data)
  }
  return data
}

function messageFromDetail(detail: unknown): string | null {
  if (detail == null) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail.map((x) =>
      typeof x === 'string'
        ? x
        : typeof x === 'object' && x !== null && 'msg' in x
          ? String((x as { msg?: string }).msg ?? '')
          : JSON.stringify(x),
    )
    const joined = parts.join(' ').trim()
    return joined || null
  }
  if (typeof detail === 'object') {
    return JSON.stringify(detail)
  }
  return String(detail)
}

/**
 * Extract a user-facing message from an HTTP error response body.
 * Returns null if nothing usable was found (caller may use status / fallback).
 */
function messageFromResponseBody(data: unknown): string | null {
  const normalized = normalizeData(data)
  if (normalized == null) return null

  if (typeof normalized === 'string') {
    const s = normalized.trim()
    return s || null
  }

  if (typeof normalized !== 'object' || normalized === null) {
    return String(normalized)
  }

  const o = normalized as Record<string, unknown>

  const fromDetail = messageFromDetail(o.detail)
  if (fromDetail) return fromDetail

  if (typeof o.message === 'string' && o.message.trim()) {
    return o.message.trim()
  }

  if (typeof o.error === 'string') {
    const desc = o.error_description
    if (typeof desc === 'string' && desc.trim()) {
      return `${o.error}: ${desc}`.trim()
    }
    return o.error
  }

  return null
}

export function formatApiError(err: unknown): string {
  const e = err as {
    response?: { data?: unknown; status?: number }
    message?: string
  }

  const fromBody = messageFromResponseBody(e.response?.data)
  if (fromBody) return fromBody

  if (e.response) {
    return e.message || 'Something went wrong'
  }

  return e.message || 'Something went wrong'
}
