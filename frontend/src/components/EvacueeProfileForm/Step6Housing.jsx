import React from 'react'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step6Housing({ data, onChange, errors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="evpf-field">
        <label>Accommodation preference</label>

        <div className="evpf-radioRow">
          <label className="evpf-radioCard">
            <input
              type="radio"
              name="accom"
              value="airbnb"
              checked={data.accommodation_preference === 'airbnb'}
              onChange={() => onChange({ accommodation_preference: 'airbnb' })}
            />
            airbnb
          </label>

          <label className="evpf-radioCard">
            <input
              type="radio"
              name="accom"
              value="hotel"
              checked={data.accommodation_preference === 'hotel'}
              onChange={() => onChange({ accommodation_preference: 'hotel' })}
            />
            hotel
          </label>
        </div>

        <FieldError errors={errors} name="accommodation_preference" />
      </div>

      <div className="evpf-field">
        <label>Estimated stay duration</label>
        <input
          className="evpf-input"
          value={data.estimated_stay_duration}
          onChange={(e) => onChange({ estimated_stay_duration: e.target.value })}
          placeholder="e.g. 2 weeks / 30 days"
        />
        <FieldError errors={errors} name="estimated_stay_duration" />
      </div>
    </div>
  )
}