import React from 'react'
import ImportanceSlider from './ImportanceSlider'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step7Extra({ data, onChange, errors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="evpf-field">
        <div className="evpf-checkbox">
          <input
            type="checkbox"
            checked={data.needs_medical_proximity}
            onChange={(e) => onChange({ needs_medical_proximity: e.target.checked })}
          />
          <span>Needs medical proximity</span>
        </div>
        <FieldError errors={errors} name="needs_medical_proximity" />
      </div>

      <ImportanceSlider
        label="Services importance"
        value={data.services_importance}
        onChange={(v) => onChange({ services_importance: v })}
        error={errors?.services_importance}
      />

      <div className="evpf-field">
        <label>Notes (optional)</label>
        <textarea
          className="evpf-textarea"
          rows="5"
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Any extra details relevant for matching..."
        />
        <FieldError errors={errors} name="notes" />
      </div>
    </div>
  )
}