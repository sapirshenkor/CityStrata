import React from 'react'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step4ReligiousCultural({ data, onChange, errors }) {
  return (
    <div className="evpf-grid sm2">
      <div className="evpf-field">
        <label>Religious affiliation</label>
        <select
          className="evpf-select"
          value={data.religious_affiliation}
          onChange={(e) => onChange({ religious_affiliation: e.target.value })}
        >
          <option value="secular">secular</option>
          <option value="traditional">traditional</option>
          <option value="religious">religious</option>
          <option value="haredi">haredi</option>
          <option value="other">other</option>
        </select>
        <FieldError errors={errors} name="religious_affiliation" />
      </div>

      <div className="evpf-field">
        <label>Culture frequency</label>
        <select
          className="evpf-select"
          value={data.culture_frequency}
          onChange={(e) => onChange({ culture_frequency: e.target.value })}
        >
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
          <option value="rarely">rarely</option>
        </select>
        <FieldError errors={errors} name="culture_frequency" />
      </div>

      <div className="evpf-field evpf-span2">
        <div className="evpf-checkbox">
          <input
            type="checkbox"
            checked={data.needs_synagogue}
            onChange={(e) => onChange({ needs_synagogue: e.target.checked })}
          />
          <span>Needs synagogue</span>
        </div>
        <FieldError errors={errors} name="needs_synagogue" />
      </div>
    </div>
  )
}