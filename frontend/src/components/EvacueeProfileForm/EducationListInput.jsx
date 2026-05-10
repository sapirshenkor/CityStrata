import React, { useMemo, useState } from 'react'
import { EDUCATION_SERVICE_KEY_TUPLE, educationServiceLabelHe } from './educationServiceOptions'

export default function EducationListInput({ items, onChange, error }) {
  const [selected, setSelected] = useState('')

  const available = useMemo(() => {
    const chosen = new Set(items ?? [])
    return EDUCATION_SERVICE_KEY_TUPLE.filter((k) => !chosen.has(k))
  }, [items])

  const add = () => {
    const key = selected
    if (!key || (items ?? []).includes(key)) return
    onChange([...(items ?? []), key])
    setSelected('')
  }

  const removeAt = (idx) => {
    const next = [...(items ?? [])]
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-sm font-extrabold text-foreground">דרישות חינוך חיוניות</div>

      <div className="flex flex-col gap-2.5 min-[400px]:flex-row min-[400px]:items-center">
        <select
          className="evpf-select min-w-0 flex-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">בחרו סוג מוסד…</option>
          {available.map((key) => (
            <option key={key} value={key}>
              {educationServiceLabelHe(key)}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} className="evpf-btn primary shrink-0 text-sm" disabled={!selected}>
          הוסף
        </button>
      </div>

      {error ? <div className="evpf-error">{error}</div> : null}

      <div className="evpf-chips">
        {(items ?? []).map((key, idx) => (
          <span key={`${key}-${idx}`} className="evpf-chip">
            {educationServiceLabelHe(key)}
            <button type="button" onClick={() => removeAt(idx)} aria-label="הסרת פריט">
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
