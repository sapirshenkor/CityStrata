const EARTH_RADIUS_METERS = 6371008.8

/** Align with backend `HUB_LABEL_HE` in tactical_utils.py */
const HUB_LABEL_HE = {
  zone_alpha: 'אזור אלפא',
  zone_beta: 'אזור בטא',
  zone_gamma: 'אזור גמא',
}

/**
 * Distinct substrings to find a zone inside the LLM letter (Hebrew + raw hub tokens).
 */
export function hebrewSearchPhrasesForHub(hub_label) {
  const raw = (hub_label || '').trim().toLowerCase()
  const phrases = []
  if (raw && HUB_LABEL_HE[raw]) phrases.push(HUB_LABEL_HE[raw])
  if (raw) {
    phrases.push(raw)
    phrases.push(raw.replace(/_/g, ' '))
  }
  return [...new Set(phrases.filter(Boolean))]
}

/**
 * Body of "## המלצת המערכת" only — excludes the static "## אזורי מגורים מומלצים" block.
 */
export function extractLlmRecommendationSection(agent_output) {
  if (agent_output == null || typeof agent_output !== 'string') return ''
  const m = agent_output.match(
    /##\s*המלצת המערכת\s*\n([\s\S]*?)(?=\n---\s*\n|\n##\s+[^\n#])/,
  )
  return m ? m[1].trim() : ''
}

/**
 * Order tactical radii by first mention in the stored LLM narrative (same section as the prompt).
 * Falls back to API order when the section is missing or empty.
 */
export function orderRadiiByLlmNarrative(agent_output, radii) {
  if (!Array.isArray(radii) || radii.length === 0) return []
  const section = extractLlmRecommendationSection(agent_output)
  if (!section) return [...radii]

  const scored = radii.map((zone, originalIndex) => {
    const phrases = hebrewSearchPhrasesForHub(zone?.hub_label)
    let firstMention = Infinity
    for (const p of phrases) {
      const idx = section.indexOf(p)
      if (idx !== -1 && idx < firstMention) firstMention = idx
    }
    return { zone, originalIndex, firstMention }
  })

  scored.sort((a, b) => {
    if (a.firstMention !== b.firstMention) return a.firstMention - b.firstMention
    return a.originalIndex - b.originalIndex
  })

  return scored.map((s) => s.zone)
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const rLat1 = toRadians(lat1)
  const rLat2 = toRadians(lat2)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isPointInsideZone(lat, lon, zone) {
  const centerLat = Number(zone?.center_lat)
  const centerLng = Number(zone?.center_lng)
  const radiusM = Number(zone?.radius_m)
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radiusM)) {
    return false
  }
  return distanceMeters(lat, lon, centerLat, centerLng) <= radiusM
}

export function isPointInsideRecommendationRadii(lat, lon, recommendation) {
  const zones = recommendation?.radii_data
  if (!Array.isArray(zones) || zones.length === 0) return true

  return zones.some((zone) => {
    return isPointInsideZone(lat, lon, zone)
  })
}
