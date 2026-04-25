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
    <div className="flex flex-col gap-2.5">
      <div className="text-sm font-extrabold text-foreground">דרישות חינוך חיוניות</div>

      <div className="flex flex-col gap-2.5 min-[400px]:flex-row min-[400px]:items-center">
        <input
          className="evpf-input min-w-0 flex-1"
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
        <button type="button" onClick={add} className="evpf-btn primary shrink-0 text-sm">
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