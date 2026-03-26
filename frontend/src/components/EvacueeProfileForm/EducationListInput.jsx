import React, { useState } from 'react'

export default function EducationListInput({ items, onChange, error }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim()
    if (!t) return
    onChange([...(items ?? []), t])
    setDraft('')
  }

  const removeAt = (idx) => {
    const next = [...(items ?? [])]
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 800, color: '#333' }}>דרישות חינוך חיוניות</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="evpf-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="הקלד/י ולחץ/י Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button className="evpf-btn primary" type="button" onClick={add}>
          הוסף
        </button>
      </div>

      {error ? <div className="evpf-error">{error}</div> : null}

      <div className="evpf-chips">
        {(items ?? []).map((it, idx) => (
          <span key={`${it}-${idx}`} className="evpf-chip">
            {it}
            <button type="button" onClick={() => removeAt(idx)} aria-label="Remove">
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}