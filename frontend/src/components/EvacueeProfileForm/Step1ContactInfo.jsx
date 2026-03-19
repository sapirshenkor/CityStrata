import React from 'react'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step1ContactInfo({ data, onChange, errors }) {
  return (
    <div className="evpf-grid sm2">
      <div className="evpf-field">
        <label>Family name</label>
        <input
          className="evpf-input"
          value={data.family_name}
          onChange={(e) => onChange({ family_name: e.target.value })}
        />
        <FieldError errors={errors} name="family_name" />
      </div>

      <div className="evpf-field">
        <label>Contact name</label>
        <input
          className="evpf-input"
          value={data.contact_name}
          onChange={(e) => onChange({ contact_name: e.target.value })}
        />
        <FieldError errors={errors} name="contact_name" />
      </div>

      <div className="evpf-field">
        <label>Contact phone</label>
        <input
          className="evpf-input"
          value={data.contact_phone}
          onChange={(e) => onChange({ contact_phone: e.target.value })}
        />
        <FieldError errors={errors} name="contact_phone" />
      </div>

      <div className="evpf-field">
        <label>Contact email</label>
        <input
          className="evpf-input"
          type="email"
          value={data.contact_email}
          onChange={(e) => onChange({ contact_email: e.target.value })}
        />
        <FieldError errors={errors} name="contact_email" />
      </div>

      <div className="evpf-field">
        <label>Home stat 2022 (optional)</label>
        <input
          className="evpf-input"
          type="number"
          value={data.home_stat_2022 ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ home_stat_2022: v === '' ? null : Number(v) })
          }}
        />
        <FieldError errors={errors} name="home_stat_2022" />
      </div>

      <div className="evpf-field">
        <label>City name</label>
        <input
          className="evpf-input"
          value={data.city_name}
          onChange={(e) => onChange({ city_name: e.target.value })}
        />
        <FieldError errors={errors} name="city_name" />
      </div>

      <div className="evpf-field evpf-span2">
        <label>Home address</label>
        <input
          className="evpf-input"
          value={data.home_address}
          onChange={(e) => onChange({ home_address: e.target.value })}
        />
        <FieldError errors={errors} name="home_address" />
      </div>
    </div>
  )
}