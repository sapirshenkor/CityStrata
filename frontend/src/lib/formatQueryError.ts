/** Shared formatter for axios/React Query errors (FastAPI `detail`, Error, fallback). */
export function formatQueryError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = err as { response?: { data?: { detail?: unknown } } }
    const d = r.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x) => JSON.stringify(x)).join(', ')
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}
