const EARTH_RADIUS_METERS = 6371008.8

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

export function isPointInsideRecommendationRadii(lat, lon, recommendation) {
  const zones = recommendation?.radii_data
  if (!Array.isArray(zones) || zones.length === 0) return true

  return zones.some((zone) => {
    const centerLat = Number(zone.center_lat)
    const centerLng = Number(zone.center_lng)
    const radiusM = Number(zone.radius_m)
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radiusM)) {
      return false
    }
    return distanceMeters(lat, lon, centerLat, centerLng) <= radiusM
  })
}
