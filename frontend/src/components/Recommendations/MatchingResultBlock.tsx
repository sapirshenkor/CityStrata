import { Badge } from '@/components/ui/badge'

const CONFIDENCE_LABELS: Record<string, { label: string }> = {
  high: { label: 'גבוהה' },
  medium: { label: 'בינונית' },
  low: { label: 'נמוכה' },
}

export function ConfidenceBadge({ value }: { value?: string | null }) {
  const v = value?.toLowerCase()
  const variant =
    v === 'high' ? 'success' : v === 'medium' ? 'warning' : v === 'low' ? 'secondary' : 'outline'
  const label = (v && CONFIDENCE_LABELS[v]?.label) ?? value ?? '—'
  return (
    <Badge variant={variant} className="shrink-0">
      {label}
    </Badge>
  )
}

export interface MatchingData {
  created_at?: string
  recommended_cluster_number?: number | null
  recommended_cluster?: string
  confidence?: string | null
  reasoning?: string
  alternative_cluster?: string
  alternative_reasoning?: string
  flags?: string[]
}

export function MatchingResultBlock({ data }: { data?: MatchingData | null }) {
  if (!data) return null
  const created = data.created_at
    ? new Date(data.created_at).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  return (
    <section className="rec-matching-section" aria-labelledby="rec-matching-heading">
      <h4 id="rec-matching-heading" className="rec-matching-title">
        התאמת מאקרו (אשכול)
      </h4>
      {created && (
        <p className="rec-matching-meta">
          נשמר {created}
          {data.recommended_cluster_number != null && (
            <span className="rec-matching-run">
              {' '}
              · אשכול #{data.recommended_cluster_number}
            </span>
          )}
        </p>
      )}
      <div className="rec-matching-row">
        <span className="rec-matching-label">מומלץ</span>
        <strong className="rec-matching-value">{data.recommended_cluster}</strong>
        <ConfidenceBadge value={data.confidence} />
      </div>
      <p className="rec-matching-reasoning">{data.reasoning}</p>
      <div className="rec-matching-row">
        <span className="rec-matching-label">חלופה</span>
        <span className="rec-matching-value">{data.alternative_cluster}</span>
      </div>
      <p className="rec-matching-reasoning rec-matching-reasoning--alt">{data.alternative_reasoning}</p>
      {data.flags && data.flags.length > 0 && (
        <div className="rec-matching-flags">
          <span className="rec-matching-label">דגלים</span>
          <ul>
            {data.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
