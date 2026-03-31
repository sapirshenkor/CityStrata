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
        <label>סך הכל נפשות</label>
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
        ['infants',    'תינוקות (0-1)'],
        ['preschool',  'גיל גן (2-5)'],
        ['elementary', 'גיל יסודי (6-12)'],
        ['youth',      'נוער (13-18)'],
        ['adults',     'מבוגרים'],
        ['seniors',    'קשישים'],
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
          <span>יש לבן/בת המשפחה מוגבלות ניידות</span>
        </div>
        <FieldError errors={errors} name="has_mobility_disability" />

        <div className="evpf-checkbox">
          <input
            type="checkbox"
            checked={data.has_car}
            onChange={(e) => onChange({ has_car: e.target.checked })}
          />
          <span>יש רכב פרטי</span>
        </div>
        <FieldError errors={errors} name="has_car" />
      </div>
    </div>
  )
}
