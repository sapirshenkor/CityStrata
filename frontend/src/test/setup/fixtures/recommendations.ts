/**
 * Recommendation overview row fixtures aligned with backend/tests/api/test_recommendations.py
 */

export interface RecommendationOverviewRow {
  profile_uuid: string
  family_name: string
  has_matching: boolean
  has_tactical: boolean
  cluster_number: number | null
  is_merged_profile: boolean
  tactical_created_at?: string | null
}

export function makeOverviewRow(
  overrides: Partial<RecommendationOverviewRow> = {},
): RecommendationOverviewRow {
  return {
    profile_uuid: '11111111-1111-4111-8111-111111111111',
    family_name: 'Cohen',
    has_matching: false,
    has_tactical: false,
    cluster_number: 1,
    is_merged_profile: false,
    tactical_created_at: null,
    ...overrides,
  }
}

export function makeOverviewFixture(): RecommendationOverviewRow[] {
  return [
    makeOverviewRow({
      profile_uuid: '11111111-1111-4111-8111-111111111111',
      family_name: 'Cohen',
      has_matching: false,
      has_tactical: false,
      cluster_number: 1,
    }),
    makeOverviewRow({
      profile_uuid: '22222222-2222-4222-8222-222222222222',
      family_name: 'Levi',
      has_matching: true,
      has_tactical: false,
      cluster_number: 2,
    }),
    makeOverviewRow({
      profile_uuid: '33333333-3333-4333-8333-333333333333',
      family_name: 'Merged Group',
      has_matching: true,
      has_tactical: true,
      cluster_number: 2,
      is_merged_profile: true,
    }),
  ]
}

export function makeMatchingResult(profileUuid: string) {
  return {
    profile_uuid: profileUuid,
    recommended_cluster_number: 2,
    cluster_name: 'Cluster B',
    confidence: 'high',
  }
}

export function makeTacticalRecommendation(profileUuid: string) {
  return {
    profile_uuid: profileUuid,
    confidence: 'high',
    agent_output: '## המלצת המערכת\n\nSafe zone identified.',
    radii_data: [{ hub_label: 'zone_alpha', radius_m: 500, center_lat: 29.55, center_lng: 34.95 }],
  }
}
