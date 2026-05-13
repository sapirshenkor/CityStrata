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

/**
 * Map mini-bar scope: all lodging types in the active radius filter, or a single layer.
 * Matches filtering in `PublicListingsPanel` (priority index or -1 for all radii).
 */
export function collectLodgingLngLatsForFit(
  scope,
  recommendation,
  focusedRadiusPriorityIndex,
  apartments,
  hotelFeatures,
  airbnbFeatures,
) {
  const points = []

  const inFilteredZones = (lat, lon) => {
    if (!recommendation?.radii_data?.length) return true
    const rec = recommendation
    const radiiRaw = Array.isArray(rec.radii_data) ? rec.radii_data : []
    const ordered = orderRadiiByLlmNarrative(String(rec.agent_output ?? ''), radiiRaw)
    const idx = typeof focusedRadiusPriorityIndex === 'number' ? focusedRadiusPriorityIndex : -1
    if (idx === -1) return isPointInsideRecommendationRadii(lat, lon, recommendation)
    const zone = ordered[idx]
    return zone ? isPointInsideZone(lat, lon, zone) : false
  }

  const wantApartments = scope === 'radius' || scope === 'apartments'
  const wantHotels = scope === 'radius' || scope === 'hotels'
  const wantAirbnb = scope === 'radius' || scope === 'airbnb'

  if (wantApartments && Array.isArray(apartments)) {
    for (const listing of apartments) {
      const lat = Number(listing?.latitude)
      const lon = Number(listing?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      if (!inFilteredZones(lat, lon)) continue
      points.push([lon, lat])
    }
  }

  if (wantHotels && Array.isArray(hotelFeatures)) {
    for (const feature of hotelFeatures) {
      const coords = feature?.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) continue
      const lon = Number(coords[0])
      const lat = Number(coords[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      if (!inFilteredZones(lat, lon)) continue
      points.push([lon, lat])
    }
  }

  if (wantAirbnb && Array.isArray(airbnbFeatures)) {
    for (const feature of airbnbFeatures) {
      const coords = feature?.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) continue
      const lon = Number(coords[0])
      const lat = Number(coords[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      if (!inFilteredZones(lat, lon)) continue
      points.push([lon, lat])
    }
  }

  return points
}

/** Mapbox LngLatBoundsLike: [[west, south], [east, north]] */
export function lngLatPointsToBounds(points) {
  if (!Array.isArray(points) || points.length === 0) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const pair of points) {
    const lng = Number(pair?.[0])
    const lat = Number(pair?.[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  if (!Number.isFinite(minLng)) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
