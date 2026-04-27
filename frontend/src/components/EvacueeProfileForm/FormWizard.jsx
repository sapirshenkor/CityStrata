import React, { useMemo, useState } from 'react'
import api from '../../services/api'

import Step1ContactInfo from './Step1ContactInfo'
import Step2FamilyComposition from './Step2FamilyComposition'
import Step3Education from './Step3Education'
import Step4ReligiousCultural from './Step4ReligiousCultural'
import Step5Community from './Step5Community'
import Step6Housing from './Step6Housing'
import Step7Extra from './Step7Extra'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import './EvacueeProfileForm.css'
import {
  evacueeFamilyProfileCreateSchema,
  stepSchemas,
  formatZodErrors,
  toPayload,
} from './evacueeFamilyProfileSchemas'

const initialData = {
  // Contact Info
  family_name: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  home_stat_2022: null,
  city_name: '',
  home_address: '',

  // Family Composition
  total_people: 1,
  infants: 0,
  preschool: 0,
  elementary: 0,
  youth: 0,
  adults: 0,
  seniors: 0,
  has_mobility_disability: false,
  has_car: true,

  // Education
  essential_education: [],
  education_proximity_importance: 3,

  // Religious/Cultural
  religious_affiliation: 'secular',
  needs_synagogue: false,
  culture_frequency: 'rarely',

  // Community
  matnas_participation: false,
  social_venues_importance: 3,
  needs_community_proximity: false,

  // Housing
  accommodation_preference: 'airbnb',
  estimated_stay_duration: '',

  // Extra
  needs_medical_proximity: false,
  services_importance: 3,
  notes: '',
}

export default function FormWizard() {
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
    []
  )

  const [stepIdx, setStepIdx] = useState(0)
  const [data, setData] = useState(initialData)
  const [errors, setErrors] = useState({})
  const [submitState, setSubmitState] = useState({
    status: 'idle', // idle | submitting | success | error
    message: null,
    result: null,
  })

  const current = steps[stepIdx]
  const CurrentComponent = current.Component
  const currentSchema = stepSchemas[current.key]

  const setField = (patch) => {
    setData((prev) => ({ ...prev, ...patch }))
    setErrors((prev) => ({ ...prev }))
  }

  const validateCurrentStep = () => {
    const res = currentSchema.safeParse(data)
    if (res.success) {
      setErrors({})
      return true
    }
    setErrors(formatZodErrors(res.error))
    return false
  }

  const goNext = () => {
    const ok = validateCurrentStep()
    if (!ok) return
    setStepIdx((i) => Math.min(i + 1, steps.length - 1))
  }

  const goBack = () => {
    setErrors({})
    setStepIdx((i) => Math.max(i - 1, 0))
  }

  const handleSubmit = async () => {
    setSubmitState({ status: 'submitting', message: null, result: null })

    const parsed = evacueeFamilyProfileCreateSchema.safeParse(data)
    if (!parsed.success) {
      setErrors(formatZodErrors(parsed.error))
      setSubmitState({
        status: 'error',
        message: 'יש לתקן את השדות המסומנים ולנסות שוב.',
        result: null,
      })
      return
    }

    try {
      const payload = toPayload(parsed.data)
      const res = await api.post('/api/evacuee-family-profiles', payload)

      setSubmitState({
        status: 'success',
        message: 'הפרופיל נשלח בהצלחה.',
        result: res.data,
      })
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'השליחה נכשלה'
      setSubmitState({
        status: 'error',
        message: detail,
        result: null,
      })
    }
  }

  const isLast = stepIdx === steps.length - 1

  return (
    <Card className="max-w-[720px] border-border bg-card shadow-md" dir="rtl">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="text-lg font-bold text-foreground">{current.title}</div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">
              שלב {stepIdx + 1} מתוך {steps.length}
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

      <CardContent className="space-y-4">
        {submitState.status === 'success' ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
            הפרופיל נשלח בהצלחה.
            <div className="mt-1.5 text-xs font-bold">
              מזהה: {submitState.result?.uuid ? String(submitState.result.uuid) : '(לא זמין)'}
            </div>
          </div>
        ) : null}

        {submitState.status === 'error' ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            {submitState.message}
          </div>
        ) : null}

        <CurrentComponent data={data} onChange={setField} errors={errors} />
      </CardContent>

      <CardFooter className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={stepIdx === 0 || submitState.status === 'submitting'}
        >
          חזור
        </Button>

        {!isLast ? (
          <Button type="button" onClick={goNext} disabled={submitState.status === 'submitting'}>
            הבא
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={submitState.status === 'submitting'}
          >
            {submitState.status === 'submitting' ? 'שולח...' : 'שלח'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}