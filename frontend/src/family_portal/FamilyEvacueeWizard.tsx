import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import Step1ContactInfo from '../components/EvacueeProfileForm/Step1ContactInfo'
import Step2FamilyComposition from '../components/EvacueeProfileForm/Step2FamilyComposition'
import Step3Education from '../components/EvacueeProfileForm/Step3Education'
import Step4ReligiousCultural from '../components/EvacueeProfileForm/Step4ReligiousCultural'
import Step5Community from '../components/EvacueeProfileForm/Step5Community'
import Step6Housing from '../components/EvacueeProfileForm/Step6Housing'
import Step7Extra from '../components/EvacueeProfileForm/Step7Extra'
import '../components/EvacueeProfileForm/EvacueeProfileForm.css'
import '../user_dashboard/dashboard.css'
import UserBar from '@/components/UserBar'
import {
  evacueeFamilyProfileCreateSchema,
  toPayload,
} from '../components/EvacueeProfileForm/evacueeFamilyProfileSchemas'
import {
  useCreateFamilyProfile,
  useFamilyProfile,
  useUpdateFamilyProfile,
} from './hooks/useFamilyQueries'

type FormValues = z.infer<typeof evacueeFamilyProfileCreateSchema>

const initialData: FormValues = {
  family_name: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  home_stat_2022: null,
  city_name: '',
  home_address: '',
  total_people: 1,
  infants: 0,
  preschool: 0,
  elementary: 0,
  youth: 0,
  adults: 0,
  seniors: 0,
  has_mobility_disability: false,
  has_car: true,
  essential_education: [],
  education_proximity_importance: 3,
  religious_affiliation: 'secular',
  needs_synagogue: false,
  culture_frequency: 'rarely',
  matnas_participation: false,
  social_venues_importance: 3,
  needs_community_proximity: false,
  accommodation_preference: 'airbnb',
  estimated_stay_duration: '',
  needs_medical_proximity: false,
  services_importance: 3,
  notes: '',
}

const STEP_FIELDS: (keyof FormValues)[][] = [
  [
    'family_name',
    'contact_name',
    'contact_phone',
    'contact_email',
    'home_stat_2022',
    'city_name',
    'home_address',
  ],
  [
    'total_people',
    'infants',
    'preschool',
    'elementary',
    'youth',
    'adults',
    'seniors',
    'has_mobility_disability',
    'has_car',
  ],
  ['essential_education', 'education_proximity_importance'],
  ['religious_affiliation', 'needs_synagogue', 'culture_frequency'],
  ['matnas_participation', 'social_venues_importance', 'needs_community_proximity'],
  ['accommodation_preference', 'estimated_stay_duration'],
  ['needs_medical_proximity', 'services_importance', 'notes'],
]

function rhfErrorsToFlat(errors: FieldErrors<FormValues>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(errors)) {
    const err = errors[key as keyof FormValues]
    if (err && typeof err === 'object' && 'message' in err && err.message) {
      out[key] = String(err.message)
    }
  }
  return out
}

function mapApiToForm(p: Record<string, unknown>): FormValues {
  const str = (v: unknown) => (v == null ? '' : String(v))
  const num = (v: unknown, d: number) =>
    typeof v === 'number' && !Number.isNaN(v) ? v : d

  return {
    family_name: str(p.family_name),
    contact_name: str(p.contact_name),
    contact_phone: str(p.contact_phone),
    contact_email: str(p.contact_email),
    home_stat_2022:
      p.home_stat_2022 === null || p.home_stat_2022 === undefined
        ? null
        : Number(p.home_stat_2022),
    city_name: str(p.city_name),
    home_address: str(p.home_address),
    total_people: num(p.total_people, 1) || 1,
    infants: num(p.infants, 0),
    preschool: num(p.preschool, 0),
    elementary: num(p.elementary, 0),
    youth: num(p.youth, 0),
    adults: num(p.adults, 0),
    seniors: num(p.seniors, 0),
    has_mobility_disability: Boolean(p.has_mobility_disability),
    has_car: p.has_car !== false,
    essential_education: Array.isArray(p.essential_education)
      ? (p.essential_education as string[])
      : [],
    education_proximity_importance: num(p.education_proximity_importance, 3),
    religious_affiliation: (p.religious_affiliation as FormValues['religious_affiliation']) ?? 'secular',
    needs_synagogue: Boolean(p.needs_synagogue),
    culture_frequency: (p.culture_frequency as FormValues['culture_frequency']) ?? 'rarely',
    matnas_participation: Boolean(p.matnas_participation),
    social_venues_importance: num(p.social_venues_importance, 3),
    needs_community_proximity: Boolean(p.needs_community_proximity),
    accommodation_preference:
      (p.accommodation_preference as FormValues['accommodation_preference']) ?? 'airbnb',
    estimated_stay_duration: p.estimated_stay_duration == null ? '' : str(p.estimated_stay_duration),
    needs_medical_proximity: Boolean(p.needs_medical_proximity),
    services_importance: num(p.services_importance, 3),
    notes: p.notes == null ? '' : str(p.notes),
  }
}

export default function FamilyEvacueeWizard() {
  const { uuid } = useParams<{ uuid: string }>()
  const isEdit = Boolean(uuid)
  const navigate = useNavigate()
  const [stepIdx, setStepIdx] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: existing, isLoading: loadingProfile, isError: loadError, error: loadErr } =
    useFamilyProfile(uuid, isEdit)

  const createMut = useCreateFamilyProfile()
  const updateMut = useUpdateFamilyProfile(uuid)

  const form = useForm<FormValues>({
    resolver: zodResolver(evacueeFamilyProfileCreateSchema),
    defaultValues: initialData,
    mode: 'onBlur',
  })

  const { watch, setValue, handleSubmit, reset, trigger, formState } = form

  useEffect(() => {
    if (isEdit && existing) {
      reset(mapApiToForm(existing as Record<string, unknown>))
    }
  }, [isEdit, existing, reset])

  const data = watch()
  const flatErrors = rhfErrorsToFlat(formState.errors)

  const setField = (patch: Partial<FormValues>) => {
    Object.entries(patch).forEach(([k, v]) => {
      setValue(k as keyof FormValues, v as never, { shouldDirty: true, shouldTouch: true })
    })
  }

  const steps = useMemo(
    () => [
      { key: 'step1', title: 'פרטי קשר', Component: Step1ContactInfo },
      { key: 'step2', title: 'הרכב משפחה', Component: Step2FamilyComposition },
      { key: 'step3', title: 'חינוך', Component: Step3Education },
      { key: 'step4', title: 'דת ותרבות', Component: Step4ReligiousCultural },
      { key: 'step5', title: 'קהילה', Component: Step5Community },
      { key: 'step6', title: 'דיור', Component: Step6Housing },
      { key: 'step7', title: 'מידע נוסף', Component: Step7Extra },
    ],
    [],
  )

  const current = steps[stepIdx]
  const CurrentComponent = current.Component
  const isLast = stepIdx === steps.length - 1

  const goNext = async () => {
    const fields = STEP_FIELDS[stepIdx]
    const ok = await trigger(fields)
    if (ok) setStepIdx((i) => Math.min(i + 1, steps.length - 1))
  }

  const goBack = () => {
    setStepIdx((i) => Math.max(i - 1, 0))
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    const payload = toPayload(values)
    try {
      if (isEdit) {
        await updateMut.mutateAsync(payload)
      } else {
        await createMut.mutateAsync(payload)
      }
      navigate('/family')
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null
      setSubmitError(
        typeof detail === 'string' ? detail : e instanceof Error ? e.message : 'Save failed',
      )
    }
  }

  const submitting = createMut.isPending || updateMut.isPending

  if (isEdit && loadingProfile) {
    return (
      <div className="dashboard-app flex min-h-screen flex-col items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">Loading profile…</p>
      </div>
    )
  }

  if (isEdit && loadError) {
    return (
      <div className="dashboard-app flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-sm text-destructive">
          {loadErr instanceof Error ? loadErr.message : 'Could not load profile.'}
        </p>
        <Button asChild variant="outline">
          <Link to="/family">Back to dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="dashboard-app min-h-screen" dir="rtl">
      <header className="dashboard-app__gradient px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-9 border border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link to="/family" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              חזרה ללוח הבקרה
            </Link>
          </Button>
          <div className="min-w-0 max-w-full sm:max-w-[min(100%,22rem)]">
            <UserBar />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] min-w-0 p-4 pb-10">
        <Card className="border-border bg-card shadow-md">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="text-lg font-bold text-foreground">{current.title}</div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">
                  שלב {stepIdx + 1} מתוך {steps.length}
                  {isEdit ? ' · עריכה' : ' · יצירה'}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2" aria-hidden="true">
                {steps.map((s, idx) => (
                  <div
                    key={s.key}
                    className={`h-1.5 w-7 rounded-full ${idx === stepIdx ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>
          </CardHeader>

          {/* Block native form submit (Enter in inputs) — only explicit save button runs handleSubmit */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
            }}
            noValidate
          >
            <CardContent className="space-y-4">
              {submitError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              <CurrentComponent data={data} onChange={setField} errors={flatErrors} />
            </CardContent>

            <CardFooter className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={stepIdx === 0 || submitting}
              >
                חזור
              </Button>

              {!isLast ? (
                <Button type="button" onClick={() => void goNext()} disabled={submitting}>
                  הבא
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={submitting}
                  onClick={() => void handleSubmit(onSubmit)()}
                >
                  {submitting ? 'שומר...' : isEdit ? 'שמירה' : 'שליחה'}
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
