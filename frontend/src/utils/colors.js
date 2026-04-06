/**
 * Color schemes for map layers
 */

// Statistical Areas — 25 fills: saturated enough to read on OSM tiles; cycled by stat_2022
export const getAreaColor = (stat2022) => {
  const colors = [
    '#E85555', '#2EB8AE', '#2A9FD1', '#E8885C', '#6BC4A8',
    '#E5C82E', '#9B6FCE', '#5AA8D9', '#E5A21E', '#3DA66A',
    '#D95A4E', '#3A9FD4', '#3DB87A', '#D9B82E', '#9468B8',
    '#E07068', '#4A9BDC', '#4AA896', '#E5C82E', '#9B6FCE',
    '#D95A4E', '#3A9FD4', '#3DB87A', '#D9B82E', '#9468B8',
  ]
  return colors[(stat2022 - 1) % colors.length]
}

// Layer colors
export const layerColors = {
  statisticalAreas: {
    fill: '#4A90E2',
    /** Dark outline so boundaries stay readable over light map tiles */
    stroke: '#0f172a',
    selected: '#e11d48',
  },
  institutions: {
    fill: '#52BE80',
    stroke: '#27AE60',
  },
  airbnb: {
    fill: '#E74C3C',
    stroke: '#C0392B',
  },
  restaurants: {
    fill: '#F39C12',
    stroke: '#D68910',
  },
  coffeeShops: {
    fill: '#8B4513',
    stroke: '#654321',
  },
}

// Get color for area based on selection state
export const getAreaStyle = (stat2022, isSelected) => {
  return {
    fillColor: isSelected ? layerColors.statisticalAreas.selected : getAreaColor(stat2022),
    color: layerColors.statisticalAreas.stroke,
    weight: isSelected ? 4 : 2.5,
    opacity: 1,
    fillOpacity: isSelected ? 0.58 : 0.46,
  }
}

// Clusters (K=4 from pipeline): fixed color per cluster index
export const CLUSTER_COLORS = ['#4C72B0', '#2ca02c', '#d62728', '#ff7f0e']

export const getClusterStyle = (cluster, isSelected) => {
  const fillColor = CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] ?? '#888'
  return {
    fillColor: isSelected ? layerColors.statisticalAreas.selected : fillColor,
    color: '#0f172a',
    weight: isSelected ? 4 : 2.5,
    opacity: 1,
    fillOpacity: isSelected ? 0.62 : 0.52,
  }
}

