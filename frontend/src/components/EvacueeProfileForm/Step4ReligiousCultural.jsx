import React from 'react'
import FieldHelpIcon from './FieldHelpIcon'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return <div className="evpf-error">{errors[name]}</div>
}

export default function Step4ReligiousCultural({ data, onChange, errors }) {
  return (
    <div className="evpf-grid sm2">
      <div className="evpf-field">
        <label>זהות דתית</label>
        {/* option value stays as the English key the backend expects */}
        <select
          className="evpf-select"
          value={data.religious_affiliation}
          onChange={(e) => onChange({ religious_affiliation: e.target.value })}
        >
          <option value="secular">חילוני</option>
          <option value="traditional">מסורתי</option>
          <option value="religious">דתי</option>
          <option value="haredi">חרדי</option>
          <option value="other">אחר</option>
        </select>
        <FieldError errors={errors} name="religious_affiliation" />
      </div>

      <div className="evpf-field">
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <label htmlFor="evpf-s4-culture" className="!mb-0 text-sm font-semibold text-muted-foreground">
            תדירות פעילות תרבותית
          </label>
          <FieldHelpIcon
            text="באיזו תדירות המשפחה נוהגת לצרוך אירועי תרבות, פנאי או הצגות?"
            ariaLabel="הסבר על תדירות פעילות תרבותית"
          />
        </div>
        <select
          id="evpf-s4-culture"
          className="evpf-select"
          value={data.culture_frequency}
          onChange={(e) => onChange({ culture_frequency: e.target.value })}
        >
          <option value="daily">יומי</option>
          <option value="weekly">שבועי</option>
          <option value="rarely">לעתים נדירות</option>
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
          <span>זקוקים לבית כנסת בסמיכות</span>
        </div>
        <FieldError errors={errors} name="needs_synagogue" />
      </div>
    </div>
  )
}
