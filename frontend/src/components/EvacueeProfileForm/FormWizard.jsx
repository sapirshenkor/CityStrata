import React, { useMemo, useState } from 'react'
import api from '../../services/api'

import Step1ContactInfo from './Step1ContactInfo'
import Step2FamilyComposition from './Step2FamilyComposition'
import Step3Education from './Step3Education'
import Step4ReligiousCultural from './Step4ReligiousCultural'
import Step5Community from './Step5Community'
import Step6Housing from './Step6Housing'
import Step7Extra from './Step7Extra'

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
      { key: 'step1', title: 'Contact Info', Component: Step1ContactInfo },
      { key: 'step2', title: 'Family Composition', Component: Step2FamilyComposition },
      { key: 'step3', title: 'Education', Component: Step3Education },
      { key: 'step4', title: 'Religious & Culture', Component: Step4ReligiousCultural },
      { key: 'step5', title: 'Community', Component: Step5Community },
      { key: 'step6', title: 'Housing', Component: Step6Housing },
      { key: 'step7', title: 'Extra', Component: Step7Extra },
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
        message: 'Please fix the highlighted fields and try again.',
        result: null,
      })
      return
    }

    try {
      const payload = toPayload(parsed.data)
      const res = await api.post('/api/evacuee-family-profiles', payload)

      setSubmitState({
        status: 'success',
        message: 'Profile submitted successfully.',
        result: res.data,
      })
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Submission failed'
      setSubmitState({
        status: 'error',
        message: detail,
        result: null,
      })
    }
  }

  const isLast = stepIdx === steps.length - 1

  return (
    <div className="evpf-card">
      <div className="evpf-header">
        <div>
          <div className="evpf-title">{current.title}</div>
          <div className="evpf-stepinfo">
            Step {stepIdx + 1} of {steps.length}
          </div>
        </div>

        <div className="evpf-stepsbar" aria-hidden="true">
          {steps.map((s, idx) => (
            <div
              key={s.key}
              className={`evpf-stepdot ${idx === stepIdx ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>

      {submitState.status === 'success' ? (
        <div className="evpf-success-banner">
          {submitState.message}
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700 }}>
            UUID: {submitState.result?.uuid ? String(submitState.result.uuid) : '(n/a)'}
          </div>
        </div>
      ) : null}

      {submitState.status === 'error' ? (
        <div className="evpf-error-banner">{submitState.message}</div>
      ) : null}

      <CurrentComponent data={data} onChange={setField} errors={errors} />

      <div className="evpf-actions">
        <button
          className="evpf-btn secondary"
          type="button"
          onClick={goBack}
          disabled={stepIdx === 0 || submitState.status === 'submitting'}
        >
          Back
        </button>

        {!isLast ? (
          <button
            className="evpf-btn primary"
            type="button"
            onClick={goNext}
            disabled={submitState.status === 'submitting'}
          >
            Next
          </button>
        ) : (
          <button
            className="evpf-btn success"
            type="button"
            onClick={handleSubmit}
            disabled={submitState.status === 'submitting'}
          >
            {submitState.status === 'submitting' ? 'Submitting...' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}