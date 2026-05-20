import type { ReactNode } from 'react'

/**
 * Mapbox / react-map-gl test double.
 * Import and register at the top of map-adjacent test files:
 *
 *   vi.mock('react-map-gl/mapbox', () => mapboxGlTestDouble)
 *
 * Never assert coordinates, tiles, or WebGL behavior — only orchestration around the mock.
 */
export function MockMap({ children }: { children?: ReactNode }) {
  return <div data-testid="mock-mapbox-map">{children}</div>
}

export function MockSource({ children }: { children?: ReactNode }) {
  return <div data-testid="mock-mapbox-source">{children}</div>
}

export const mapboxGlTestDouble = {
  default: MockMap,
  NavigationControl: () => null,
  FullscreenControl: () => null,
  Source: MockSource,
  Layer: () => null,
  useMap: () => ({ current: null }),
}

/**
 * Leaflet test double for municipality dashboard map tests.
 *
 *   vi.mock('react-leaflet', () => leafletTestDouble)
 */
export const leafletTestDouble = {
  MapContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-leaflet-map">{children}</div>
  ),
  TileLayer: () => null,
  GeoJSON: () => null,
  useMap: () => ({
    fitBounds: () => undefined,
  }),
}
