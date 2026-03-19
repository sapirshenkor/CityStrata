import React from 'react'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step2FamilyComposition({ data, onChange, errors }) {
  const setInt = (key, raw) => {
    const v = raw === '' ? 0 : Number(raw)
    onChange({ [key]: v })
  }

  return (
    <div className="evpf-grid sm2">
      <div className="evpf-field evpf-span2">
        <label>Total people</label>
        <input
          className="evpf-input"
          type="number"
          min="0"
          value={data.total_people}
          onChange={(e) => setInt('total_people', e.target.value)}
        />
        <FieldError errors={errors} name="total_people" />
      </div>

      {[
        ['infants', 'Infants'],
        ['preschool', 'Preschool'],
        ['elementary', 'Elementary'],
        ['youth', 'Youth'],
        ['adults', 'Adults'],
        ['seniors', 'Seniors'],
      ].map(([key, label]) => (
        <div key={key} className="evpf-field">
          <label>{label}</label>
          <input
            className="evpf-input"
            type="number"
            min="0"
            value={data[key]}
            onChange={(e) => setInt(key, e.target.value)}
          />
          <FieldError errors={errors} name={key} />
        </div>
      ))}

      <div className="evpf-field evpf-span2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="evpf-checkbox">
          <input
            type="checkbox"
            checked={data.has_mobility_disability}
            onChange={(e) => onChange({ has_mobility_disability: e.target.checked })}
          />
          <span>Has mobility disability</span>
        </div>
        <FieldError errors={errors} name="has_mobility_disability" />

        <div className="evpf-checkbox">
          <input
            type="checkbox"
            checked={data.has_car}
            onChange={(e) => onChange({ has_car: e.target.checked })}
          />
          <span>Has car</span>
        </div>
        <FieldError errors={errors} name="has_car" />
      </div>
    </div>
  )
}