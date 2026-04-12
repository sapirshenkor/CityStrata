import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  communityProfilesKeys,
  useCommunityProfilesQuery,
} from '../../hooks/useCommunityProfilesData'
import {
  getMatchingResultForCommunity,
  runMatchingForCommunityProfile,
} from '../../services/api'
import { COMMUNITY_TYPES, HOUSING_PREFERENCES } from '../CommunityForm/communityFormSchema'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import '../Recommendations/RecommendationsPanel.css'

function pid(id) {
  return id != null ? String(id) : ''
}

function labelCommunityType(value) {
  return COMMUNITY_TYPES.find((o) => o.value === value)?.label ?? value ?? '—'
}

function labelHousing(value) {
  return HOUSING_PREFERENCES.find((o) => o.value === value)?.label ?? value ?? '—'
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

const CONFIDENCE_LABELS = {
  high: { label: 'גבוהה' },
  medium: { label: 'בינונית' },
  low: { label: 'נמוכה' },
}

function ConfidenceBadge({ value }) {
  const v = value?.toLowerCase()
  const variant =
    v === 'high' ? 'success' : v === 'medium' ? 'warning' : v === 'low' ? 'secondary' : 'outline'
  const label = CONFIDENCE_LABELS[v]?.label ?? value ?? '—'
  return (
    <Badge variant={variant} className="shrink-0">
      {label}
    </Badge>
  )
}

function CommunityMatchingBlock({ data }) {
  if (!data) return null
  const created = data.created_at
    ? new Date(data.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
    : null
  return (
    <section className="rec-matching-section" aria-labelledby="cp-matching-heading">
      <h4 id="cp-matching-heading" className="rec-matching-title">
        התאמת אשכול (מאקרו)
      </h4>
      {created && (
        <p className="rec-matching-meta">
          נשמר {created}
          {data.recommended_cluster_number != null && (
            <span className="rec-matching-run"> · אשכול #{data.recommended_cluster_number}</span>
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
      {data.flags?.length > 0 && (
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

/**
 * Sidebar tab: browse saved community_profiles (same list + detail pattern as Recommendations).
 */
export default function CommunityProfilesPanel() {
  const queryClient = useQueryClient()
  const {
    data: list = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useCommunityProfilesQuery()

  const loadError = queryError ? String(queryError.message) : null
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [matchingDetail, setMatchingDetail] = useState(null)
  const [matchingLoading, setMatchingLoading] = useState(false)
  const [matchingBusy, setMatchingBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((row) => {
      const hay = [
        row.community_name,
        row.leader_name,
        row.contact_email,
        row.contact_phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [list, search])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: communityProfilesKeys.list() })
    await refetch()
  }

  const handleRowClick = (row) => {
    if (selected && pid(selected.id) === pid(row.id)) {
      setSelected(null)
      setMatchingDetail(null)
      return
    }
    setSelected(row)
    setMatchingDetail(null)
    setActionError(null)
  }

  useEffect(() => {
    if (!selected?.selected_matching_result_id) {
      setMatchingDetail(null)
      setMatchingLoading(false)
      return
    }
    let cancelled = false
    setMatchingLoading(true)
    getMatchingResultForCommunity(selected.id)
      .then((res) => {
        if (!cancelled) setMatchingDetail(res.data)
      })
      .catch(() => {
        if (!cancelled) setMatchingDetail(null)
      })
      .finally(() => {
        if (!cancelled) setMatchingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const handleRunMatching = async (e, row) => {
    e.stopPropagation()
    setActionError(null)
    const key = pid(row.id)
    setMatchingBusy(key)
    try {
      await runMatchingForCommunityProfile(row.id)
      await queryClient.invalidateQueries({ queryKey: communityProfilesKeys.list() })
      const { data: freshList } = await refetch()
      const listArr = freshList ?? []
      const updated = listArr.find((r) => pid(r.id) === key)
      if (updated) {
        setSelected(updated)
        try {
          const m = await getMatchingResultForCommunity(updated.id)
          setMatchingDetail(m.data)
        } catch {
          setMatchingDetail(null)
        }
      }
    } catch (err) {
      setActionError(err.response?.data?.detail ?? err.message ?? 'שגיאה')
    } finally {
      setMatchingBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="rec-panel space-y-3 p-1" dir="rtl">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <p className="text-center text-xs text-muted-foreground">טוען פרופילי קהילה…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rec-panel" dir="rtl">
        <div className="rec-state rec-state--error" role="alert">
          <strong>לא ניתן לטעון נתונים</strong>
          <br />
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="rec-panel" dir="rtl">
      <header className="rec-panel-header">
        <h1 className="rec-panel-title">פרופילי קהילה</h1>
        <p className="rec-panel-subtitle">
          רשימת קהילות שנשמרו במערכת. לחצו על שורה לצפייה בפרטים מלאים.
        </p>
      </header>

      {actionError && (
        <div className="rec-banner rec-banner--error mb-3" role="alert">
          {actionError}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="min-w-0 flex-1 rounded-md border border-[var(--rec-border)] bg-white px-2 py-1.5 text-xs"
          placeholder="חיפוש לפי שם, איש קשר, טלפון…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="חיפוש קהילות"
        />
        <button
          type="button"
          className="rounded-md border border-[var(--rec-border)] bg-white px-2 py-1.5 text-xs font-medium text-[var(--rec-text)] hover:bg-slate-50"
          onClick={() => refresh()}
        >
          רענון
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rec-state rec-state--empty">
          <div className="rec-state-icon" aria-hidden>
            🏘️
          </div>
          <strong>אין עדיין פרופילי קהילה</strong>
          <p style={{ margin: '8px 0 0' }}>
            הוסיפו קהילה בלשונית Community, ואז חזרו לכאן לצפייה ברשימה.
          </p>
        </div>
      ) : (
        <div className="rec-layout">
          <div className="rec-layout-list">
            <div className="rec-list-section">
              <div className="rec-list-heading">
                <h2 id="cp-list-heading">קהילות</h2>
                <span className="rec-list-hint" id="cp-list-hint">
                  {filtered.length === list.length
                    ? `${list.length} רשומות`
                    : `מציג ${filtered.length} מתוך ${list.length}`}
                </span>
              </div>
              {filtered.length === 0 ? (
                <div className="rec-filter-empty" role="status">
                  <p>אין תוצאות לחיפוש.</p>
                  <button type="button" className="rec-filters-clear" onClick={() => setSearch('')}>
                    נקה חיפוש
                  </button>
                </div>
              ) : (
                <ul className="rec-list" aria-labelledby="cp-list-heading" aria-describedby="cp-list-hint">
                  {filtered.map((row) => {
                    const active = selected && pid(selected.id) === pid(row.id)
                    const rowClass = ['rec-item', active ? 'rec-item--active' : 'rec-item--tactical']
                      .filter(Boolean)
                      .join(' ')
                    const hasMatching = Boolean(row.selected_matching_result_id)
                    return (
                      <li key={pid(row.id)} className={rowClass} onClick={() => handleRowClick(row)}>
                        <div className="rec-item-body" style={{ width: '100%' }}>
                          <span className="rec-family-name">{row.community_name || '—'}</span>
                          <div className="rec-item-meta">
                            {hasMatching ? (
                              <span className="rec-match-pill">אשכול הוקצה</span>
                            ) : (
                              <span className="rec-match-pill rec-match-pill--muted">ללא התאמת אשכול</span>
                            )}
                            <span className="rec-match-pill">{labelCommunityType(row.community_type)}</span>
                            <span className="rec-zone-count">{row.total_people} נפשות</span>
                          </div>
                        </div>
                        <div className="rec-item-actions">
                          <button
                            type="button"
                            className="rec-action-btn rec-action-btn--match"
                            disabled={matchingBusy === pid(row.id)}
                            onClick={(e) => handleRunMatching(e, row)}
                          >
                            {matchingBusy === pid(row.id) ? 'מריץ…' : 'הרצת התאמת אשכול'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rec-layout-detail">
            {!selected && (
              <div className="rec-detail">
                <div className="rec-detail-placeholder">
                  <strong>בחרו קהילה</strong>
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                    לחצו על שורה ברשימה כדי לראות את כל השדות שנשמרו.
                  </p>
                </div>
              </div>
            )}

            {selected && (
              <div className="rec-detail">
                <div className="rec-detail-header">
                  <div className="rec-detail-header-main">
                    <h3 className="rec-detail-name">{selected.community_name}</h3>
                  </div>
                  <button
                    className="rec-detail-close"
                    type="button"
                    onClick={() => setSelected(null)}
                    title="סגור"
                    aria-label="סגור פאנל"
                  >
                    ✕
                  </button>
                </div>

                {matchingLoading && (
                  <div className="rec-detail-loading border-b border-[var(--rec-border)] px-4 py-3">
                    <div className="rec-spinner" aria-hidden />
                    טוען תוצאת התאמה…
                  </div>
                )}

                {!matchingLoading && matchingDetail && (
                  <div className="border-b border-[var(--rec-border)] px-2 pb-3 pt-2">
                    <CommunityMatchingBlock data={matchingDetail} />
                  </div>
                )}

                <div className="cp-detail-body space-y-3 p-4 text-right text-sm">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rec-action-btn rec-action-btn--match"
                      disabled={matchingBusy === pid(selected.id)}
                      onClick={(e) => handleRunMatching(e, selected)}
                    >
                      {matchingBusy === pid(selected.id) ? 'מריץ…' : 'הרצת התאמת אשכול'}
                    </button>
                  </div>
                  <DetailRow label="מזהה" value={pid(selected.id)} mono />
                  <DetailRow label="שם איש קשר" value={selected.leader_name} />
                  <DetailRow label="טלפון" value={selected.contact_phone} />
                  <DetailRow label="אימייל" value={selected.contact_email} />
                  <DetailRow label="סוג קהילה" value={labelCommunityType(selected.community_type)} />
                  <DetailRow label="מספר משפחות" value={selected.total_families} />
                  <DetailRow label="סה״כ נפשות" value={selected.total_people} />
                  <p className="border-t border-[var(--rec-border)] pt-2 font-semibold text-[var(--rec-text)]">
                    הרכב גילאים
                  </p>
                  <DetailRow label="תינוקות (0–1)" value={selected.infants} />
                  <DetailRow label="גן (2–5)" value={selected.preschool} />
                  <DetailRow label="יסודי (6–12)" value={selected.elementary} />
                  <DetailRow label="נוער (13–18)" value={selected.youth} />
                  <DetailRow label="מבוגרים" value={selected.adults} />
                  <DetailRow label="קשישים" value={selected.seniors} />
                  <DetailRow label="חשיבות לכידות (1–5)" value={selected.cohesion_importance} />
                  <DetailRow label="העדפת מגורים" value={labelHousing(selected.housing_preference)} />
                  <DetailRow
                    label="צרכים"
                    value={[
                      selected.needs_synagogue ? 'בית כנסת' : null,
                      selected.needs_community_center ? 'מתנ״ס' : null,
                      selected.needs_education_institution ? 'מוסד חינוכי' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  />
                  <DetailRow label="הערות" value={selected.infrastructure_notes || '—'} multiline />
                  <DetailRow label="נוצר" value={formatWhen(selected.created_at)} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono, multiline }) {
  const v = value == null || value === '' ? '—' : String(value)
  return (
    <div className="cp-detail-row">
      <div className="text-xs font-medium text-[var(--rec-text-muted)]">{label}</div>
      <div
        className={`mt-0.5 text-[var(--rec-text)] ${mono ? 'font-mono text-[11px] break-all' : ''} ${multiline ? 'whitespace-pre-wrap' : ''}`}
      >
        {v}
      </div>
    </div>
  )
}
