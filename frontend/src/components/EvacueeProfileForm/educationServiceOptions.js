/** Canonical keys for API `essential_education` (TEXT[]). Hebrew labels are UI-only. */
export const EDUCATION_SERVICE_KEY_TUPLE = Object.freeze([
  'kindergarten',
  'elementary',
  'middle_school',
  'high_school',
  'special_education',
])

export const EDUCATION_SERVICE_LABELS_HE = Object.freeze({
  kindergarten: 'גני ילדים',
  elementary: 'בית ספר יסודי',
  middle_school: 'חטיבת ביניים',
  high_school: 'בית ספר תיכון',
  special_education: 'חינוך מיוחד',
})

/** @param {string} key */
export function educationServiceLabelHe(key) {
  return EDUCATION_SERVICE_LABELS_HE[key] ?? key
}

/** @param {unknown} value */
export function isEducationServiceKey(value) {
  return typeof value === 'string' && EDUCATION_SERVICE_KEY_TUPLE.includes(value)
}
