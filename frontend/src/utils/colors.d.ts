import type { PathOptions } from 'leaflet'

export function getAreaColor(stat2022: number): string
export function getAreaStyle(stat2022: number, isSelected: boolean): PathOptions
export function getClusterStyle(cluster: number, isSelected: boolean): PathOptions
export const layerColors: Record<string, { fill: string; stroke: string; selected?: string }>
export const CLUSTER_COLORS: readonly string[]
