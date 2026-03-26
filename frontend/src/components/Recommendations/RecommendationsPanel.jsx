import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { getRecommendations } from '../../services/api'
import './RecommendationsPanel.css'

const CONFIDENCE_LABELS = {
  high:   { label: 'High',   cls: 'conf-high'   },
  medium: { label: 'Medium', cls: 'conf-medium'  },
  low:    { label: 'Low',    cls: 'conf-low'     },
}

function ConfidenceBadge({ value }) {
  const meta = CONFIDENCE_LABELS[value?.toLowerCase()] ?? { label: value ?? '—', cls: 'conf-unknown' }
  return <span className={`rec-confidence ${meta.cls}`}>{meta.label}</span>
}

/**
 * Recommendations tab content.
 *
 * Props
 * -----
 * selectedRecommendation : full recommendation object or null
 * onSelectRecommendation  : (rec | null) => void
 */
function RecommendationsPanel({ selectedRecommendation, onSelectRecommendation }) {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    getRecommendations()
      .then((res) => setRecommendations(res.data))
      .catch((err) => setError(err.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="rec-state">Loading recommendations…</div>
  }

  if (error) {
    return <div className="rec-state rec-state--error">Error: {error}</div>
  }

  if (recommendations.length === 0) {
    return (
      <div className="rec-state rec-state--empty">
        No recommendations yet.
        <br />
        Run the tactical agent for a family first.
      </div>
    )
  }

  const selected = selectedRecommendation

  return (
    <div className="rec-panel">
      {/* ── Family list ─────────────────────────────────────────── */}
      <ul className="rec-list">
        {recommendations.map((rec) => (
          <li
            key={rec.id}
            className={`rec-item ${selected?.id === rec.id ? 'rec-item--active' : ''}`}
            onClick={() => onSelectRecommendation(selected?.id === rec.id ? null : rec)}
          >
            <span className="rec-family-name">{rec.family_name}</span>
            <div className="rec-item-meta">
              <ConfidenceBadge value={rec.confidence} />
              <span className="rec-zone-count">
                {rec.radii_data?.length ?? 0} zone{rec.radii_data?.length !== 1 ? 's' : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* ── Detail panel for the selected family ────────────────── */}
      {selected && (
        <div className="rec-detail">
          <div className="rec-detail-header">
            <div>
              <h3 className="rec-detail-name">{selected.family_name}</h3>
              <ConfidenceBadge value={selected.confidence} />
            </div>
            <button
              className="rec-detail-close"
              onClick={() => onSelectRecommendation(null)}
              title="Close"
            >
              ✕
            </button>
          </div>

          {selected.radii_data?.length > 0 && (
            <div className="rec-zones-summary">
              {selected.radii_data.map((z, i) => (
                <span key={z.hub_label ?? i} className={`rec-zone-badge rec-zone-badge--${i}`}>
                  {(z.hub_label ?? `zone_${i}`)
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                  {' '}· {z.radius_m} m
                </span>
              ))}
            </div>
          )}

          <div className="rec-markdown">
            <ReactMarkdown>{selected.agent_output}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecommendationsPanel
