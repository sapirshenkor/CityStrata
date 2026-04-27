import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import {
  getRecommendationByProfile,
  getMatchingResultForProfile,
  runMatchingForProfile,
  runTacticalForProfile,
  runCommunityTactical,
} from '../../services/api'
import { recommendationsKeys, useRecommendationsOverviewQuery } from '../../hooks/useRecommendationsData'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfidenceBadge, MatchingResultBlock } from './MatchingResultBlock'
import './RecommendationsPanel.css'

function pid(u) {
  return u != null ? String(u) : ''
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
  const queryClient = useQueryClient()
  const {
    data: overview = [],
    isLoading: loading,
    error: overviewQueryError,
    refetch: refetchOverview,
  } = useRecommendationsOverviewQuery()
  const loadError = overviewQueryError ? String(overviewQueryError.message) : null
  const [selectedOverview, setSelectedOverview] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const [matchingBusy, setMatchingBusy] = useState(null)
  const [tacticalBusy, setTacticalBusy] = useState(null)
  const [communityBusy, setCommunityBusy] = useState(false)
  const [communitySelection, setCommunitySelection] = useState(() => new Set())
  const [matchingDetail, setMatchingDetail] = useState(null)

  const [clusterFilter, setClusterFilter] = useState('')
  const [filterMergedOnly, setFilterMergedOnly] = useState(false)
  const [filterNeedsCluster, setFilterNeedsCluster] = useState(false)
  const [filterNeedsTactical, setFilterNeedsTactical] = useState(false)

  const clusterOptions = useMemo(() => {
    const set = new Set()
    overview.forEach((r) => {
      if (r.cluster_number != null) set.add(r.cluster_number)
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [overview])

  const filteredOverview = useMemo(() => {
    return overview.filter((row) => {
      if (clusterFilter === 'follow') {
        const n = selectedOverview?.cluster_number
        if (n != null && row.cluster_number !== n) return false
      } else if (clusterFilter !== '') {
        const n = Number(clusterFilter)
        if (Number.isFinite(n) && row.cluster_number !== n) return false
      }
      if (filterMergedOnly && !row.is_merged_profile) return false
      if (filterNeedsCluster && row.has_matching) return false
      if (filterNeedsTactical && (!row.has_matching || row.has_tactical)) return false
      return true
    })
  }, [
    overview,
    clusterFilter,
    selectedOverview,
    filterMergedOnly,
    filterNeedsCluster,
    filterNeedsTactical,
  ])

  const hasActiveFilters =
    clusterFilter !== '' ||
    filterMergedOnly ||
    filterNeedsCluster ||
    filterNeedsTactical

  const clearFilters = () => {
    setClusterFilter('')
    setFilterMergedOnly(false)
    setFilterNeedsCluster(false)
    setFilterNeedsTactical(false)
  }

  const refreshOverview = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: recommendationsKeys.overview() })
      await refetchOverview()
    } catch (err) {
      setActionError(err.response?.data?.detail ?? err.message)
    }
  }

  useEffect(() => {
    if (clusterFilter === 'follow' && selectedOverview?.cluster_number == null) {
      setClusterFilter('')
    }
  }, [clusterFilter, selectedOverview])

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

  const toggleCommunityMember = (profileUuid) => {
    const key = pid(profileUuid)
    setCommunitySelection((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCommunityTactical = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setActionError(null)
    const ids = Array.from(communitySelection)
    if (ids.length < 2) return
    setCommunityBusy(true)
    try {
      const res = await runCommunityTactical(ids)
      await queryClient.invalidateQueries({ queryKey: recommendationsKeys.overview() })
      const { data: freshData } = await refetchOverview()
      const fresh = freshData ?? []
      setCommunitySelection(new Set())
      const newId = pid(res.data.profile_uuid)
      const row = fresh.find((r) => pid(r.profile_uuid) === newId)
      if (row) {
        setSelectedOverview(row)
        setMatchingDetail(null)
        if (row.has_matching) {
          try {
            const m = await getMatchingResultForProfile(row.profile_uuid)
            setMatchingDetail(m.data)
          } catch {
            /* optional */
          }
        }
      }
      onSelectRecommendation(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail ?? err.message)
    } finally {
      setCommunityBusy(false)
    }
  }

  const communityEligibleCount = overview.filter(
    (r) => communitySelection.has(pid(r.profile_uuid)) && r.has_matching,
  ).length
  const communityCanRun =
    communitySelection.size >= 2 && communityEligibleCount === communitySelection.size

  if (loading) {
    return (
      <div className="rec-panel space-y-3 p-1">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <p className="text-center text-xs text-muted-foreground">טוען משפחות...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rec-panel">
        <div className="rec-state rec-state--error" role="alert">
          <strong>לא ניתן לטעון נתונים</strong>
          <br />
          {loadError}
        </div>
      </div>
    )
  }

  if (overview.length === 0) {
    return (
      <div className="rec-panel">
        <div className="rec-state rec-state--empty">
          <div className="rec-state-icon" aria-hidden>
            📋
          </div>
          <strong>אין עדיין משפחות</strong>
          <p style={{ margin: '8px 0 0' }}>
            הוסיפו פרופילי משפחות מפונות בלשונית המשפחה, ואז חזרו לכאן להרצת התאמות
            והמלצות טקטיות.
          </p>
        </div>
      </div>
    )
  }

  const detailMatchesSelection =
    selectedRecommendation &&
    selectedOverview &&
    pid(selectedRecommendation.profile_uuid) === pid(selectedOverview.profile_uuid)

  const selectionCount = communitySelection.size

  return (
    <div className="rec-panel">
      <header className="rec-panel-header">
        <h1 className="rec-panel-title">המלצות</h1>
        <p className="rec-panel-subtitle">
          הריצו התאמה לשיוך אשכול, ולאחר מכן הריצו דוח טקטי לאזורים. פתחו משפחה לצפייה בפרטים.
        </p>
      </header>

      {actionError && (
        <div className="rec-banner rec-banner--error" role="alert">
          {actionError}
        </div>
      )}

      <section className="rec-community" aria-label="מיזוג משפחות לפרופיל קהילה אחד">
        <div className="rec-community-inner">
          <div className="rec-community-copy">
            <span className="rec-community-kicker">מיזוג קהילה</span>
            <p className="rec-community-lead">
              סמנו <strong>שתי</strong> שורות או יותר שכבר עברו התאמת אשכול. הפעולה יוצרת
              פרופיל מאוחד ומריצה שלב טקטי לקהילה (עשוי להימשך כמה דקות).
            </p>
          </div>
          <div className="rec-community-toolbar">
            {selectionCount > 0 && (
              <span
                role="status"
                aria-live="polite"
                className={`rec-community-status ${
                  communityCanRun ? 'rec-community-status--ok' : 'rec-community-status--warn'
                }`}
              >
                {selectionCount} נבחרו
                {communityCanRun && ' · מוכן'}
                {!communityCanRun && selectionCount >= 2 && ' · נדרש אשכול לכולן'}
                {!communityCanRun && selectionCount < 2 && ' · בחרו עוד משפחה'}
              </span>
            )}
            <button
              type="button"
              className="rec-community-submit"
              disabled={!communityCanRun || communityBusy}
              title={
                !communityCanRun
                  ? 'בחרו שתי משפחות או יותר שכבר עברו התאמת מאקרו'
                  : 'יצירת פרופיל מאוחד והרצת דוח טקטי לקהילה'
              }
              onClick={handleCommunityTactical}
            >
              {communityBusy ? 'מבצע...' : 'מיזוג והרצה'}
            </button>
          </div>
        </div>
      </section>

      <div className="rec-layout">
        <div className="rec-layout-list">
          <div className="rec-list-section">
            <div className="rec-list-heading">
              <h2 id="rec-families-heading">משפחות</h2>
              <span className="rec-list-hint" id="rec-families-hint">
                לחצו על שורה לפרטים · תיבת סימון = הכללה בהרצת קהילה
                {hasActiveFilters && (
                  <>
                    {' '}
                    · מציג {filteredOverview.length} מתוך {overview.length}
                  </>
                )}
              </span>
            </div>
            <div className="rec-filters" role="group" aria-label="סינון משפחות">
              <div className="rec-filters-row">
                <label className="rec-filter-label" htmlFor="rec-filter-cluster">
                  אשכול
                </label>
                <select
                  id="rec-filter-cluster"
                  className="rec-filter-select"
                  value={clusterFilter}
                  onChange={(e) => setClusterFilter(e.target.value)}
                >
                  <option value="">כל האשכולות</option>
                  {selectedOverview?.cluster_number != null && (
                    <option value="follow">
                      כמו הבחירה הנוכחית (אשכול #{selectedOverview.cluster_number})
                    </option>
                  )}
                  {clusterOptions.map((n) => (
                    <option key={n} value={String(n)}>
                      אשכול #{n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rec-filters-chips">
                <label className="rec-filter-chip">
                  <input
                    type="checkbox"
                    checked={filterMergedOnly}
                    onChange={(e) => setFilterMergedOnly(e.target.checked)}
                  />
                  <span>משפחות ממוזגות</span>
                </label>
                <label className="rec-filter-chip">
                  <input
                    type="checkbox"
                    checked={filterNeedsCluster}
                    onChange={(e) => setFilterNeedsCluster(e.target.checked)}
                  />
                  <span>ממתין לאשכול</span>
                </label>
                <label className="rec-filter-chip">
                  <input
                    type="checkbox"
                    checked={filterNeedsTactical}
                    onChange={(e) => setFilterNeedsTactical(e.target.checked)}
                  />
                  <span>ממתין לטקטי</span>
                </label>
                {hasActiveFilters && (
                  <button type="button" className="rec-filters-clear" onClick={clearFilters}>
                    ניקוי מסננים
                  </button>
                )}
              </div>
            </div>
            {filteredOverview.length === 0 ? (
              <div className="rec-filter-empty" role="status">
                <p>אין משפחות שתואמות למסננים הנוכחיים.</p>
                <button type="button" className="rec-filters-clear" onClick={clearFilters}>
                  איפוס מסננים
                </button>
              </div>
            ) : (
            <ul className="rec-list" aria-labelledby="rec-families-heading" aria-describedby="rec-families-hint">
        {filteredOverview.map((row) => {
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
              <label
                className="rec-community-select"
                onClick={(e) => e.stopPropagation()}
                title={
                  row.has_matching
                    ? 'הכללה בהרצת דוח טקטי לקהילה'
                    : 'יש להריץ קודם התאמת מאקרו'
                }
              >
                <input
                  type="checkbox"
                  checked={communitySelection.has(pid(row.profile_uuid))}
                  disabled={!row.has_matching}
                  onChange={() => toggleCommunityMember(row.profile_uuid)}
                  aria-label={`הכללת ${row.family_name} בהרצת קהילה`}
                />
              </label>
              <div className="rec-item-body">
                <span className="rec-family-name">{row.family_name}</span>
                <div className="rec-item-meta">
                  <span
                    className={`rec-status-pill ${row.has_tactical ? 'rec-status-pill--ok' : 'rec-status-pill--wait'}`}
                  >
                    {row.has_tactical ? 'דוח טקטי מוכן' : 'אין עדיין דוח טקטי'}
                  </span>
                  {row.has_matching ? (
                    <span className="rec-match-pill">הוקצה אשכול</span>
                  ) : (
                    <span className="rec-match-pill rec-match-pill--muted">נדרשת התאמה</span>
                  )}
                </div>
              </div>

              {!row.has_tactical && (
                <div className="rec-item-actions">
                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--match"
                    disabled={matchingBusy === pid(row.profile_uuid)}
                    onClick={(e) => handleMatching(e, row.profile_uuid)}
                  >
                    {matchingBusy === pid(row.profile_uuid) ? 'מריץ...' : 'הרצת התאמה'}
                  </button>
                  <button
                    type="button"
                    className="rec-action-btn rec-action-btn--tactical"
                    disabled={
                      !row.has_matching || tacticalBusy === pid(row.profile_uuid)
                    }
                    title={!row.has_matching ? 'יש להריץ קודם התאמה' : 'הפקת אזורים ודוח טקטי'}
                    onClick={(e) => handleTactical(e, row.profile_uuid)}
                  >
                    {tacticalBusy === pid(row.profile_uuid) ? 'מריץ...' : 'הרצת טקטי'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
            </ul>
            )}
          </div>
        </div>

        <div className="rec-layout-detail">
          {!selectedOverview && (
            <div className="rec-detail">
              <div className="rec-detail-placeholder">
                <strong>בחרו משפחה</strong>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  לחצו על שורה ברשימה כדי לצפות בהתאמת המאקרו ובדוח הטקטי כאשר הם זמינים.
                </p>
              </div>
            </div>
          )}

          {selectedOverview && (
            <div className="rec-detail">
              <div className="rec-detail-header">
                <div className="rec-detail-header-main">
                  <h3 className="rec-detail-name">{selectedOverview.family_name}</h3>
                  {selectedOverview.has_tactical &&
                    detailMatchesSelection &&
                    selectedRecommendation && (
                      <ConfidenceBadge value={selectedRecommendation.confidence} />
                    )}
                </div>
                <button
                  className="rec-detail-close"
                  type="button"
                  onClick={handleClose}
                  title="סגירת פאנל"
                  aria-label="סגירת פאנל פרטים"
                >
                  ✕
                </button>
              </div>

              {detailLoading && (
                <div className="rec-detail-loading">
                  <div className="rec-spinner" aria-hidden />
                  טוען דוח...
                </div>
              )}

              {!detailLoading && selectedOverview.has_matching && matchingDetail && (
                <MatchingResultBlock data={matchingDetail} />
              )}

              {!detailLoading &&
                selectedOverview.has_tactical &&
                detailMatchesSelection &&
                selectedRecommendation && (
                  <>
                    <h4 className="rec-tactical-title">דוח טקטי (אזורים ונרטיב)</h4>
                    {selectedRecommendation.radii_data?.length > 0 && (
                      <div className="rec-zones-summary">
                        {selectedRecommendation.radii_data.map((z, i) => (
                          <span
                            key={z.hub_label ?? i}
                            className={`rec-zone-badge rec-zone-badge--${i % 3}`}
                          >
                            {(z.hub_label ?? `אזור_${i}`)
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
                    <strong>השלבים הבאים:</strong> הריצו <strong>התאמה</strong> לשיוך אשכול,
                    ואז <strong>טקטי</strong> לחישוב אזורים והפקת דוח המלצה.
                  </p>
                  <div className="rec-detail-actions">
                    <button
                      type="button"
                      className="rec-action-btn rec-action-btn--match"
                      disabled={matchingBusy === pid(selectedOverview.profile_uuid)}
                      onClick={(e) => handleMatching(e, selectedOverview.profile_uuid)}
                    >
                      {matchingBusy === pid(selectedOverview.profile_uuid)
                        ? 'מריץ...'
                        : '1. הרצת התאמה'}
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
                        ? 'מריץ...'
                        : '2. הרצת טקטי'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecommendationsPanel
