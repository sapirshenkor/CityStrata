import React from 'react'

export default function ImportanceSlider({ label, value, onChange, error }) {
  return (
    <div className="evpf-sliderRow">
      <div className="evpf-sliderTop">
        <div className="text-sm font-extrabold text-foreground">{label}</div>
        <div className="evpf-sliderValue">{value} / 5</div>
      </div>

      <input
        className="evpf-range"
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      {error ? <div className="evpf-error">{error}</div> : null}
    </div>
  )
}