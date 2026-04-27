import { Circle, Tooltip } from 'react-leaflet'

// Three visually distinct colours for zone_alpha / zone_beta / zone_gamma.
// Ordered by rank: blue-600 (best) → orange → green. No brand purple.
const ZONE_COLORS = ['#2563eb', '#e67e22', '#27ae60']

function formatZoneLabel(hub_label) {
  return (hub_label || 'אזור')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Renders the recommended relocation radii for the selected family as
 * react-leaflet Circle components, each with a hover Tooltip.
 *
 * Props
 * -----
 * recommendation : TacticalAgentResponse object from the API, or null.
 *                  Reads recommendation.radii_data (array of zone objects).
 *
 * Each zone must have: center_lat, center_lng, radius_m.
 * Optional: hub_label, semantic_score, total_amenities.
 */
function RecommendationsLayer({ recommendation }) {
  if (!recommendation?.radii_data?.length) return null

  return recommendation.radii_data.map((zone, i) => (
    <Circle
      key={zone.hub_label ?? i}
      center={[zone.center_lat, zone.center_lng]}
      radius={zone.radius_m}
      pathOptions={{
        color: ZONE_COLORS[i % ZONE_COLORS.length],
        fillColor: ZONE_COLORS[i % ZONE_COLORS.length],
        fillOpacity: 0.1,
        weight: 2.5,
      }}
    >
      <Tooltip sticky>
        <div style={{ minWidth: 140 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>
            {formatZoneLabel(zone.hub_label)}
          </strong>
          <div>רדיוס: <b>{zone.radius_m} מ'</b></div>
          {zone.semantic_score != null && (
            <div>
              ציון:{' '}
              <b>{(zone.semantic_score * 100).toFixed(1)}%</b>
            </div>
          )}
          {zone.total_amenities != null && (
            <div>שירותים זמינים: <b>{zone.total_amenities}</b></div>
          )}
        </div>
      </Tooltip>
    </Circle>
  ))
}

export default RecommendationsLayer
