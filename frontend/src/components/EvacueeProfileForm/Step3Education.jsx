import React from 'react'
import EducationListInput from './EducationListInput'
import ImportanceSlider from './ImportanceSlider'

export default function Step3Education({ data, onChange, errors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <EducationListInput
        items={data.essential_education}
        onChange={(items) => onChange({ essential_education: items })}
        error={errors?.essential_education}
      />

      <ImportanceSlider
        label="Education proximity importance"
        value={data.education_proximity_importance}
        onChange={(v) => onChange({ education_proximity_importance: v })}
        error={errors?.education_proximity_importance}
      />
    </div>
  )
}