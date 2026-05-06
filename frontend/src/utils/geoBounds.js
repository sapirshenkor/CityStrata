/**
 * Bounding box as Mapbox expects: SW then NE corners, coordinates [lng, lat].
 */
export function geojsonBBoxLngLat(geometry) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  function walkRing(ring) {
    for (const coord of ring) {
      const [lng, lat] = coord
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
  }

  if (geometry.type === 'Polygon') walkRing(geometry.coordinates[0])
  else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) walkRing(polygon[0])
  } else return null

  return Number.isFinite(minLng)
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null
}

export function mergeLngLatBounds(boundsList) {
  if (!boundsList.length) return null
  const [first] = boundsList
  const out = [
    [first[0][0], first[0][1]],
    [first[1][0], first[1][1]],
  ]
  for (let i = 1; i < boundsList.length; i++) {
    const b = boundsList[i]
    out[0][0] = Math.min(out[0][0], b[0][0])
    out[0][1] = Math.min(out[0][1], b[0][1])
    out[1][0] = Math.max(out[1][0], b[1][0])
    out[1][1] = Math.max(out[1][1], b[1][1])
  }
  return out
}
