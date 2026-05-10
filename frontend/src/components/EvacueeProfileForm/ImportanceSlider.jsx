import React from 'react'
import FieldHelpIcon from './FieldHelpIcon'

export default function ImportanceSlider({ label, value, onChange, error, fieldTooltip, fieldTooltipAriaLabel }) {
  return (
    <div className="evpf-sliderRow">
      <div className="evpf-sliderTop">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <div className="text-sm font-extrabold text-foreground">{label}</div>
          {fieldTooltip ? (
            <FieldHelpIcon
              text={fieldTooltip}
              ariaLabel={fieldTooltipAriaLabel ?? `הסבר: ${label}`}
              className="size-7"
            />
          ) : null}
        </div>
        <div className="evpf-sliderValue shrink-0">{value} / 5</div>
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