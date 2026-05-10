import React from 'react'
import FieldHelpIcon from './FieldHelpIcon'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step1ContactInfo({ data, onChange, errors }) {
  return (
    <div className="evpf-grid sm2">
      <div className="evpf-field">
        <label>שם משפחה</label>
        <input
          className="evpf-input"
          value={data.family_name}
          onChange={(e) => onChange({ family_name: e.target.value })}
        />
        <FieldError errors={errors} name="family_name" />
      </div>

      <div className="evpf-field">
        <label>שם איש קשר</label>
        <input
          className="evpf-input"
          value={data.contact_name}
          onChange={(e) => onChange({ contact_name: e.target.value })}
        />
        <FieldError errors={errors} name="contact_name" />
      </div>

      <div className="evpf-field">
        <label>טלפון</label>
        <input
          className="evpf-input"
          value={data.contact_phone}
          onChange={(e) => onChange({ contact_phone: e.target.value })}
        />
        <FieldError errors={errors} name="contact_phone" />
      </div>

      <div className="evpf-field">
        <label>דוא״ל</label>
        <input
          className="evpf-input"
          type="email"
          value={data.contact_email}
          onChange={(e) => onChange({ contact_email: e.target.value })}
        />
        <FieldError errors={errors} name="contact_email" />
      </div>

      <div className="evpf-field">
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <label htmlFor="evpf-s1-home_stat" className="!mb-0 text-sm font-semibold text-muted-foreground">
            קוד סטטיסטי (אופציונלי)
          </label>
          <FieldHelpIcon
            text="מזהה ייחודי של האזור הסטטיסטי לצורכי ניתוח גאוגרפי מדויק."
            ariaLabel="הסבר על קוד סטטיסטי"
          />
        </div>
        <input
          id="evpf-s1-home_stat"
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
        <label>עיר מגורים</label>
        <input
          className="evpf-input"
          value={data.city_name}
          onChange={(e) => onChange({ city_name: e.target.value })}
        />
        <FieldError errors={errors} name="city_name" />
      </div>

      <div className="evpf-field evpf-span2">
        <label>כתובת בית</label>
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
