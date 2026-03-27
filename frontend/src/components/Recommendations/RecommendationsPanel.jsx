import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  getRecommendationsOverview,
  getRecommendationByProfile,
  getMatchingResultForProfile,
  runMatchingForProfile,
  runTacticalForProfile,
} from '../../services/api'
import './RecommendationsPanel.css'

function MatchingResultBlock({ data }) {
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
        Macro matching (cluster)
      </h4>
      {created && (
        <p className="rec-matching-meta">
          Saved {created}
          {data.recommended_cluster_number != null && (
            <span className="rec-matching-run">
              {' '}
              · Cluster #{data.recommended_cluster_number}
            </span>
          )}
        </p>
      )}
      <div className="rec-matching-row">
        <span className="rec-matching-label">Recommended</span>
        <strong className="rec-matching-value">{data.recommended_cluster}</strong>
        <ConfidenceBadge value={data.confidence} />
      </div>
      <p className="rec-matching-reasoning">{data.reasoning}</p>
      <div className="rec-matching-row">
        <span className="rec-matching-label">Alternative</span>
        <span className="rec-matching-value">{data.alternative_cluster}</span>
      </div>
      <p className="rec-matching-reasoning rec-matching-reasoning--alt">{data.alternative_reasoning}</p>
      {data.flags?.length > 0 && (
        <div className="rec-matching-flags">
          <span className="rec-matching-label">Flags</span>
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

const CONFIDENCE_LABELS = {
  high: { label: 'High', cls: 'conf-high' },
  medium: { label: 'Medium', cls: 'conf-medium' },
  low: { label: 'Low', cls: 'conf-low' },
}

function pid(u) {
  return u != null ? String(u) : ''
}

function ConfidenceBadge({ value }) {
  const meta =
    CONFIDENCE_LABELS[value?.toLowerCase()] ?? { label: value ?? '—', cls: 'conf-unknown' }
  return <span className={`rec-confidence ${meta.cls}`}>{meta.label}</span>
}

/**
 * Recommendations tab: all families from overview; tactical report detail + agent actions.
 *
 * Props
 * -----
 * selectedRecommendation : full TacticalAgentResponse from parent (map + detail)
 * onSelectRecommendation  : (rec | null) => void
 */
function RecommendationsPanel({ selectedRecommendation, onSelectRecommendation }) {
  const [overview, setOverview] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedOverview, setSelectedOverview] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const [matchingBusy, setMatchingBusy] = useState(null)
  const [tacticalBusy, setTacticalBusy] = useState(null)
  const [matchingDetail, setMatchingDetail] = useState(null)

  const refreshOverview = () =>
    getRecommendationsOverview()
      .then((res) => setOverview(res.data))
      .catch((err) => setActionError(err.response?.data?.detail ?? err.message))

  useEffect(() => {
    getRecommendationsOverview()
      .then((res) => setOverview(res.data))
      .catch((err) => setError(err.response?.data?.detail ?? err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleClose = () => {
    setSelectedOverview(null)
    setMatchingDetail(null)
    onSelectRecommendation(null)
  }

  const handleRowClick = async (row) => {
    if (selectedOverview && pid(selectedOverview.profile_uuid) === pid(row.profile_uuid)) {
      handleClose()
      return
    }

    setSelectedOverview(row)
    setActionError(null)
    setMatchingDetail(null)

    if (row.has_tactical) {
      setDetailLoading(true)
      try {
        const matchingPromise = row.has_matching
          ? getMatchingResultForProfile(row.profile_uuid).then((r) => r.data)
          : Promise.resolve(null)
        const [matchingData, recRes] = await Promise.all([
          matchingPromise,
          getRecommendationByProfile(row.profile_uuid),
        ])
        setMatchingDetail(matchingData)
        onSelectRecommendation(recRes.data)
      } catch (err) {
        setActionError(err.response?.data?.detail ?? err.message)
        onSelectRecommendation(null)
      } finally {
        setDetailLoading(false)
      }
    } else {
      onSelectRecommendation(null)
      if (row.has_matching) {
        try {
          const res = await getMatchingResultForProfile(row.profile_uuid)
          setMatchingDetail(res.data)
        } catch (err) {
          setActionError(err.response?.data?.detail ?? err.message)
        }
      }
    }
  }

  const handleMatching = async (e, profileUuid) => {
    e.stopPropagation()
    setActionError(null)
    const key = pid(profileUuid)
    setMatchingBusy(key)
    try {
      await runMatchingForProfile(profileUuid)
      await refreshOverview()
      setSelectedOverview((prev) => {
        if (!prev || pid(prev.profile_uuid) !== key) return prev
        return { ...prev, has_matching: true }
      })
      try {
        const res = await getMatchingResultForProfile(profileUuid)
        setMatchingDetail(res.data)
      } catch {
        // ignore secondary fetch; overview still updated
      }
    } catch (err) {
      setActionError(err.response?.data?.detail ?? err.message)
    } finally {
      setMatchingBusy(null)
    }
  }

  const handleTactical = async (e, profileUuid) => {
    e.stopPropagation()
    setActionError(null)
    const key = pid(profileUuid)
    setTacticalBusy(key)
    try {
      const res = await runTacticalForProfile(profileUuid)
      await refreshOverview()
      setSelectedOverview((prev) => {
        if (!prev || pid(prev.profile_uuid) !== key) return prev
        return { ...prev, has_tactical: true, has_matching: true }
      })
      onSelectRecommendation(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail ?? err.message)
    } finally {
      setTacticalBusy(null)
    }
  }

  if (loading) {
    return <div className="rec-state">Loading recommendations…</div>
  }

  if (error) {
    return <div className="rec-state rec-state--error">Error: {error}</div>
  }

  if (overview.length === 0) {
    return (
      <div className="rec-state rec-state--empty">
        No evacuee family profiles yet.
        <br />
        Add a family in the Evacuee profile tab first.
      </div>
    )
  }

  const detailMatchesSelection =
    selectedRecommendation &&
    selectedOverview &&
    pid(selectedRecommendation.profile_uuid) === pid(selectedOverview.profile_uuid)

  return (
    <div className="rec-panel">
      {actionError && (
        <div className="rec-banner rec-banner--error" role="alert">
          {actionError}
        </div>
      )}

      <ul className="rec-list">
        {overview.map((row) => {
          const active =
            selectedOverview && pid(selectedOverview.profile_uuid) === pid(row.profile_uuid)
          const rowClass = [
            'rec-item',
            active ? 'rec-item--active' : '',
            row.has_tactical ? 'rec-item--tactical' : 'rec-item--pending',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={pid(row.profile_uuid)} className={rowClass} onClick={() => handleRowClick(row)}>
              <span className="rec-family-name">{row.family_name}</span>
              <div className="rec-item-meta">
                <span
                  className={`rec-status-pill ${row.has_tactical ? 'rec-status-pill--ok' : 'rec-status-pill--wait'}`}
                >
                  {row.has_tactical ? 'Tactical report' : 'No report'}
                </span>
                {row.has_matching ? (
                  <span className="rec-match-pill">Matching ✓</span>
                ) : (
                  <span className="rec-match-pill rec-match-pill--muted">No matching</span>
                )}
              </div>

              {!row.has_tactical && (
                <div className="rec-item-actions">
                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--match"
                    disabled={matchingBusy === pid(row.profile_uuid)}
                    onClick={(e) => handleMatching(e, row.profile_uuid)}
                  >
                    {matchingBusy === pid(row.profile_uuid) ? 'Matching…' : 'Run matching'}
                  </button>
                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--tactical"
                    disabled={
                      !row.has_matching || tacticalBusy === pid(row.profile_uuid)
                    }
                    title={!row.has_matching ? 'Run matching first' : 'Run tactical agent'}
                    onClick={(e) => handleTactical(e, row.profile_uuid)}
                  >
                    {tacticalBusy === pid(row.profile_uuid) ? 'Tactical…' : 'Run tactical'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {selectedOverview && (
        <div className="rec-detail">
          <div className="rec-detail-header">
            <div>
              <h3 className="rec-detail-name">{selectedOverview.family_name}</h3>
              {selectedOverview.has_tactical && detailMatchesSelection && selectedRecommendation && (
                <ConfidenceBadge value={selectedRecommendation.confidence} />
              )}
            </div>
            <button className="rec-detail-close" type="button" onClick={handleClose} title="Close">
              ✕
            </button>
          </div>

          {detailLoading && <div className="rec-detail-loading">Loading report…</div>}

          {!detailLoading && selectedOverview.has_matching && matchingDetail && (
            <MatchingResultBlock data={matchingDetail} />
          )}

          {!detailLoading &&
            selectedOverview.has_tactical &&
            detailMatchesSelection &&
            selectedRecommendation && (
              <>
                <h4 className="rec-tactical-title">Tactical report</h4>
                {selectedRecommendation.radii_data?.length > 0 && (
                  <div className="rec-zones-summary">
                    {selectedRecommendation.radii_data.map((z, i) => (
                      <span
                        key={z.hub_label ?? i}
                        className={`rec-zone-badge rec-zone-badge--${i % 3}`}
                      >
                        {(z.hub_label ?? `zone_${i}`)
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}{' '}
                        · {z.radius_m} m
                      </span>
                    ))}
                  </div>
                )}

                <div className="rec-markdown">
                  <ReactMarkdown>{selectedRecommendation.agent_output}</ReactMarkdown>
                </div>
              </>
            )}

          {!detailLoading && !selectedOverview.has_tactical && (
            <div className="rec-detail-pending">
              <p className="rec-detail-pending-text">
                No tactical report yet. Run <strong>matching</strong> (macro cluster), then{' '}
                <strong>tactical</strong> (zones + report).
              </p>
              <div className="rec-detail-actions">
                <button
                  type="button"
                  className="rec-action-btn rec-action-btn--match"
                  disabled={matchingBusy === pid(selectedOverview.profile_uuid)}
                  onClick={(e) => handleMatching(e, selectedOverview.profile_uuid)}
                >
                  {matchingBusy === pid(selectedOverview.profile_uuid)
                    ? 'Matching…'
                    : 'Run matching'}
                </button>
                <button
                  type="button"
                  className="rec-action-btn rec-action-btn--tactical"
                  disabled={
                    !selectedOverview.has_matching ||
                    tacticalBusy === pid(selectedOverview.profile_uuid)
                  }
                  onClick={(e) => handleTactical(e, selectedOverview.profile_uuid)}
                >
                  {tacticalBusy === pid(selectedOverview.profile_uuid)
                    ? 'Tactical…'
                    : 'Run tactical'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RecommendationsPanel
