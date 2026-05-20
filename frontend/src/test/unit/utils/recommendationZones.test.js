import { describe, expect, it } from 'vitest'
import {
  collectLodgingLngLatsForFit,
  extractLlmRecommendationSection,
  hebrewSearchPhrasesForHub,
  isPointInsideRecommendationRadii,
  isPointInsideZone,
  lngLatPointsToBounds,
  orderRadiiByLlmNarrative,
} from '@/utils/recommendationZones'

describe('hebrewSearchPhrasesForHub', () => {
  it('includes Hebrew label and normalized hub tokens for known zones', () => {
    expect(hebrewSearchPhrasesForHub('zone_alpha')).toEqual([
      'אזור אלפא',
      'zone_alpha',
      'zone alpha',
    ])
  })

  it('returns empty array for missing hub label', () => {
    expect(hebrewSearchPhrasesForHub('')).toEqual([])
    expect(hebrewSearchPhrasesForHub(null)).toEqual([])
  })
})

describe('extractLlmRecommendationSection', () => {
  it('extracts the recommendation narrative section only', () => {
    const output = `## המלצת המערכת
מומלץ לשקול את אזור אלפא ליד מוסדות החינוך.
---
## אזורי מגורים מומלצים`

    expect(extractLlmRecommendationSection(output)).toBe(
      'מומלץ לשקול את אזור אלפא ליד מוסדות החינוך.',
    )
  })

  it('returns empty string for non-string or missing content', () => {
    expect(extractLlmRecommendationSection(null)).toBe('')
    expect(extractLlmRecommendationSection(undefined)).toBe('')
    expect(extractLlmRecommendationSection('no matching section')).toBe('')
  })
})

describe('orderRadiiByLlmNarrative', () => {
  const radii = [
    { hub_label: 'zone_beta', radius_m: 400 },
    { hub_label: 'zone_alpha', radius_m: 500 },
  ]

  it('returns empty array for empty or missing radii', () => {
    expect(orderRadiiByLlmNarrative('', [])).toEqual([])
    expect(orderRadiiByLlmNarrative('', null)).toEqual([])
  })

  it('preserves API order when the LLM section is missing', () => {
    expect(orderRadiiByLlmNarrative('', radii)).toEqual(radii)
  })

  it('orders zones by first Hebrew mention in the narrative', () => {
    const agentOutput = `## המלצת המערכת
ראשית מומלץ אזור בטא, ולאחר מכן אזור אלפא.`

    const ordered = orderRadiiByLlmNarrative(agentOutput, radii)
    expect(ordered.map((z) => z.hub_label)).toEqual(['zone_beta', 'zone_alpha'])
  })
})

describe('isPointInsideZone', () => {
  const zone = { center_lat: 29.55, center_lng: 34.95, radius_m: 500 }

  it('returns true for a point at the zone center', () => {
    expect(isPointInsideZone(29.55, 34.95, zone)).toBe(true)
  })

  it('returns false for invalid zone geometry', () => {
    expect(isPointInsideZone(29.55, 34.95, { center_lat: 'x' })).toBe(false)
    expect(isPointInsideZone(29.55, 34.95, null)).toBe(false)
  })
})

describe('isPointInsideRecommendationRadii', () => {
  it('returns true when no radii are defined', () => {
    expect(isPointInsideRecommendationRadii(29.55, 34.95, {})).toBe(true)
    expect(isPointInsideRecommendationRadii(29.55, 34.95, { radii_data: [] })).toBe(true)
  })

  it('returns true when the point is inside at least one zone', () => {
    const recommendation = {
      radii_data: [{ center_lat: 29.55, center_lng: 34.95, radius_m: 500 }],
    }
    expect(isPointInsideRecommendationRadii(29.55, 34.95, recommendation)).toBe(true)
  })
})

describe('lngLatPointsToBounds', () => {
  it('returns null for empty or invalid point lists', () => {
    expect(lngLatPointsToBounds([])).toBeNull()
    expect(lngLatPointsToBounds([[NaN, 29.55]])).toBeNull()
  })

  it('computes Mapbox-style bounds from lng/lat pairs', () => {
    expect(
      lngLatPointsToBounds([
        [34.95, 29.55],
        [34.96, 29.56],
      ]),
    ).toEqual([
      [34.95, 29.55],
      [34.96, 29.56],
    ])
  })
})

describe('collectLodgingLngLatsForFit', () => {
  it('collects apartment coordinates for radius scope', () => {
    const points = collectLodgingLngLatsForFit(
      'radius',
      null,
      -1,
      [{ latitude: 29.55, longitude: 34.95 }],
      [],
      [],
    )

    expect(points).toEqual([[34.95, 29.55]])
  })

  it('skips listings with invalid coordinates', () => {
    const points = collectLodgingLngLatsForFit(
      'apartments',
      null,
      -1,
      [{ latitude: 'bad', longitude: 34.95 }],
      [],
      [],
    )

    expect(points).toEqual([])
  })

  it('filters listings to a focused recommendation zone', () => {
    const recommendation = {
      agent_output: '',
      radii_data: [{ hub_label: 'zone_alpha', center_lat: 29.55, center_lng: 34.95, radius_m: 500 }],
    }

    const inside = collectLodgingLngLatsForFit(
      'apartments',
      recommendation,
      0,
      [{ latitude: 29.55, longitude: 34.95 }],
      [],
      [],
    )
    const outside = collectLodgingLngLatsForFit(
      'apartments',
      recommendation,
      0,
      [{ latitude: 30.0, longitude: 35.5 }],
      [],
      [],
    )

    expect(inside).toEqual([[34.95, 29.55]])
    expect(outside).toEqual([])
  })
})
