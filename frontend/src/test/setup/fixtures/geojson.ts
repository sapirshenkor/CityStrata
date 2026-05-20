/**
 * GeoJSON fixtures aligned with backend/tests/helpers/factories.py stat_area_row
 * and FastAPI statistical-areas FeatureCollection responses.
 */

export function makeStatAreaFeature(stat2022: number) {
  return {
    type: 'Feature' as const,
    properties: {
      stat_2022: stat2022,
      label: `Area ${stat2022}`,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [34.95, 29.55],
          [34.96, 29.55],
          [34.96, 29.56],
          [34.95, 29.56],
          [34.95, 29.55],
        ],
      ],
    },
  }
}

export function makeStatisticalAreasCollection(featureCount = 2) {
  const features = Array.from({ length: featureCount }, (_, index) =>
    makeStatAreaFeature(100 + index),
  )

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

export function makeStatisticalAreaSummary(stat2022: number) {
  return {
    stat_2022: stat2022,
    area_m2: 500_000,
    institutions_count: 3,
    airbnb_count: 5,
    restaurants_count: 8,
    coffee_shops_count: 4,
    total_airbnb_capacity: 20,
  }
}

export function makeEmptyFeatureCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: [],
  }
}
