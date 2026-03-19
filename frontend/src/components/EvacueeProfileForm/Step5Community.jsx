import React from 'react'
import ImportanceSlider from './ImportanceSlider'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step5Community({ data, onChange, errors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="evpf-grid sm2">
        <div className="evpf-field">
          <div className="evpf-checkbox">
            <input
              type="checkbox"
              checked={data.matnas_participation}
              onChange={(e) => onChange({ matnas_participation: e.target.checked })}
            />
            <span>Matnas participation</span>
          </div>
          <FieldError errors={errors} name="matnas_participation" />
        </div>

        <div className="evpf-field">
          <div className="evpf-checkbox">
            <input
              type="checkbox"
              checked={data.needs_community_proximity}
              onChange={(e) => onChange({ needs_community_proximity: e.target.checked })}
            />
            <span>Needs community proximity</span>
          </div>
          <FieldError errors={errors} name="needs_community_proximity" />
        </div>
      </div>

      <ImportanceSlider
        label="Social venues importance"
        value={data.social_venues_importance}
        onChange={(v) => onChange({ social_venues_importance: v })}
        error={errors?.social_venues_importance}
      />
    </div>
  )
}