import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, ChevronDown, ChevronUp, FileText, PlusCircle, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getMatchingResultForProfile,
  getRecommendationByProfile,
  runMatchingForProfile,
  runTacticalForProfile,
} from '../services/api'
import { ConfidenceBadge, MatchingResultBlock } from '../components/Recommendations/MatchingResultBlock'
import '../components/Recommendations/RecommendationsPanel.css'
import { useFamilyDashboard } from './hooks/useFamilyQueries'
import { familyKeys } from './queryKeys'
import '../user_dashboard/dashboard.css'

function pid(u: string | null | undefined) {
  return u != null ? String(u) : ''
}

/** Dashboard payload from GET /api/family/me/dashboard */
interface FamilyProfileRow {
  uuid: string
  family_name: string
  created_at?: string
  selected_matching_result_id?: string | null
}

export default function FamilyDashboard() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useFamilyDashboard()

  const [intelUuid, setIntelUuid] = useState<string | null>(null)
  const [matchingBusy, setMatchingBusy] = useState<string | null>(null)
  const [tacticalBusy, setTacticalBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const profiles = (data?.profiles ?? []) as FamilyProfileRow[]
  const expanded = profiles.find((p) => p.uuid === intelUuid)

  const { data: matchingDetail, isLoading: loadingMatching } = useQuery({
    queryKey: ['family', 'intel', 'matching', intelUuid],
    queryFn: () => getMatchingResultForProfile(intelUuid!).then((r) => r.data),
    enabled: Boolean(intelUuid && expanded?.selected_matching_result_id),
  })

  const { data: tacticalRec, isLoading: loadingTactical } = useQuery({
    queryKey: ['family', 'intel', 'tactical', intelUuid],
    queryFn: async () => {
      try {
        const r = await getRecommendationByProfile(intelUuid!)
        return r.data
      } catch (e: unknown) {
        const status =
          typeof e === 'object' && e !== null && 'response' in e
            ? (e as { response?: { status?: number } }).response?.status
            : undefined
        if (status === 404) return null
        throw e
      }
    },
    enabled: Boolean(intelUuid),
  })

  const detailLoading = Boolean(intelUuid) && (loadingMatching || loadingTactical)

  const handleMatching = async (e: React.MouseEvent, profileUuid: string) => {
    e.preventDefault()
    e.stopPropagation()
    setActionError(null)
    const key = pid(profileUuid)
    setMatchingBusy(key)
    try {
      await runMatchingForProfile(profileUuid)
      await queryClient.invalidateQueries({ queryKey: familyKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['family', 'intel', 'matching', profileUuid] })
      if (intelUuid === profileUuid) {
        await queryClient.invalidateQueries({ queryKey: ['family', 'intel', 'tactical', profileUuid] })
      }
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setActionError(typeof detail === 'string' ? detail : err instanceof Error ? err.message : 'Matching failed')
    } finally {
      setMatchingBusy(null)
    }
  }

  const handleTactical = async (e: React.MouseEvent, profileUuid: string) => {
    e.preventDefault()
    e.stopPropagation()
    setActionError(null)
    const key = pid(profileUuid)
    setTacticalBusy(key)
    try {
      await runTacticalForProfile(profileUuid)
      await queryClient.invalidateQueries({ queryKey: familyKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['family', 'intel', 'tactical', profileUuid] })
    } catch (err: unknown) {
      const detail =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setActionError(typeof detail === 'string' ? detail : err instanceof Error ? err.message : 'Tactical failed')
    } finally {
      setTacticalBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-app flex min-h-screen flex-col items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-[#667eea] border-t-transparent"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">Loading your dashboard…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="dashboard-app flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load dashboard.'}
        </p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">Back to map</Link>
        </Button>
      </div>
    )
  }

  const user = data?.user
  const summary = data?.summary as
    | { profile_count: number; profiles_with_matching_count: number }
    | undefined

  const profileCount = summary?.profile_count ?? profiles.length
  const withMatching = summary?.profiles_with_matching_count ?? 0

  return (
    <div className="dashboard-app flex min-h-screen flex-col" dir="rtl">
      <header className="dashboard-app__gradient px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Family portal</h1>
            <p className="mt-1 text-sm text-white/90">
              סקירה אישית של הפרופילים והסטטוס — לפי הנתונים מהמערכת.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-9 shrink-0 border border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link to="/" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              חזרה למפה
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 bg-[#f8f9fa] p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {actionError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          <Card className="border-[#e0e0e0] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-[#333]">
                <User className="h-5 w-5 text-[#667eea]" aria-hidden />
                סטטוס
              </CardTitle>
              <CardDescription className="text-[#666]">
                מידע שמגיע מהשרת בלבד — ללא סטטוסים מומצאים.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[#333]">
              {user ? (
                <div className="flex flex-col gap-1 rounded-lg border border-[#e9ecef] bg-white/80 px-3 py-2">
                  <span className="text-xs font-medium text-[#666]">משתמש רשום</span>
                  <span className="font-medium">{user.email}</span>
                  {(user.first_name || user.last_name) && (
                    <span className="text-[#666]">
                      {[user.first_name, user.last_name].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
              ) : null}

              <ul className="space-y-2 rounded-lg border border-[#e9ecef] bg-white/80 px-3 py-2">
                <li>
                  <span className="text-[#666]">מספר פרופילים משפחיים: </span>
                  <strong>{profileCount}</strong>
                </li>
                <li>
                  <span className="text-[#666]">פרופילים עם בחירת התאמה (שדה נבחר במערכת): </span>
                  <strong>{withMatching}</strong>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-[#667eea] hover:bg-[#5568d3]">
              <Link to="/family/profile/new" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" aria-hidden />
                יצירת פרופיל משפחה
              </Link>
            </Button>
          </div>

          <Card className="border-[#e0e0e0] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-[#333]">
                <FileText className="h-5 w-5 text-[#667eea]" aria-hidden />
                הפרופילים שלך
              </CardTitle>
              <CardDescription className="text-[#666]">
                רק פרופילים המקושרים לחשבון שלך. ניתן להריץ התאמת אשכול וטקטיקה כמו בלוח ההמלצות הכללי.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <p className="text-sm text-[#666]">
                  עדיין אין פרופיל. לחצו על &quot;יצירת פרופיל משפחה&quot; כדי להתחיל.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {profiles.map((p) => {
                    const hasMatching = Boolean(p.selected_matching_result_id)
                    const showIntel = intelUuid === p.uuid
                    const detailMatchesTactical =
                      tacticalRec && pid(tacticalRec.profile_uuid) === pid(p.uuid)

                    return (
                      <li
                        key={p.uuid}
                        className="rounded-lg border border-[#e9ecef] bg-white p-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-medium text-[#333]">{p.family_name}</div>
                            <div className="text-xs text-[#666]">
                              {hasMatching
                                ? 'נבחרה שורת התאמה במערכת (selected_matching_result_id).'
                                : 'לא נבחרה שורת התאמה במערכת.'}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" size="sm" className="shrink-0">
                              <Link to={`/family/profile/${p.uuid}/edit`}>עריכה</Link>
                            </Button>
                            <button
                              type="button"
                              className="rec-action-btn rec-action-btn--match shrink-0"
                              disabled={matchingBusy === pid(p.uuid)}
                              onClick={(e) => void handleMatching(e, p.uuid)}
                            >
                              {matchingBusy === pid(p.uuid) ? 'מריץ…' : 'הרצת התאמת אשכול'}
                            </button>
                            <button
                              type="button"
                              className="rec-action-btn rec-action-btn--tactical shrink-0"
                              disabled={!hasMatching || tacticalBusy === pid(p.uuid)}
                              title={
                                !hasMatching ? 'יש להריץ קודם התאמת אשכול' : 'הפקת אזורים ודוח טקטי'
                              }
                              onClick={(e) => void handleTactical(e, p.uuid)}
                            >
                              {tacticalBusy === pid(p.uuid) ? 'מריץ…' : 'הרצת טקטי'}
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-[#667eea]"
                              onClick={() => setIntelUuid(showIntel ? null : p.uuid)}
                            >
                              {showIntel ? (
                                <>
                                  <ChevronUp className="ml-1 inline h-4 w-4" aria-hidden />
                                  הסתרת פרטי ניתוח
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="ml-1 inline h-4 w-4" aria-hidden />
                                  הצגת פרטי ניתוח
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {showIntel && (
                          <div className="rec-detail mt-4 border-t border-[#e9ecef] pt-4 text-start">
                            {detailLoading && (
                              <div className="rec-detail-loading text-sm text-[#666]">
                                <span className="rec-spinner mr-2 inline-block" aria-hidden />
                                טוען פרטי ניתוח…
                              </div>
                            )}

                            {!detailLoading && hasMatching && matchingDetail && (
                              <MatchingResultBlock data={matchingDetail} />
                            )}

                            {!detailLoading && !hasMatching && (
                              <p className="rec-detail-pending-text text-sm text-[#666]">
                                <strong>המשך:</strong> להריץ <strong>התאמת אשכול</strong> כדי לשבץ
                                אשכול, ואז <strong>טקטי</strong> לחישוב אזורים ודוח.
                              </p>
                            )}

                            {!detailLoading && tacticalRec && detailMatchesTactical && (
                              <>
                                <div className="rec-detail-header-main mt-4 flex items-center gap-2">
                                  <h4 className="rec-tactical-title mb-0">דוח טקטי (אזורים ונרטיב)</h4>
                                  <ConfidenceBadge value={tacticalRec.confidence} />
                                </div>
                                {tacticalRec.radii_data?.length > 0 && (
                                  <div className="rec-zones-summary">
                                    {tacticalRec.radii_data.map((z: { hub_label?: string; radius_m?: number }, i: number) => (
                                      <span
                                        key={z.hub_label ?? i}
                                        className={`rec-zone-badge rec-zone-badge--${i % 3}`}
                                      >
                                        {(z.hub_label ?? `zone_${i}`)
                                          .replace(/_/g, ' ')
                                          .replace(/\b\w/g, (c: string) => c.toUpperCase())}{' '}
                                        · {z.radius_m} m
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="rec-markdown">
                                  <ReactMarkdown>{tacticalRec.agent_output}</ReactMarkdown>
                                </div>
                              </>
                            )}

                            {!detailLoading && hasMatching && !tacticalRec && (
                              <p className="mt-3 text-sm text-[#666]">
                                אין עדיין דוח טקטי שמור לפרופיל זה. להריץ &quot;הרצת טקטי&quot; לאחר
                                התאמת האשכול.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
