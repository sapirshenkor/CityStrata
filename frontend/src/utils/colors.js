/**
 * Color schemes for map layers
 */

// Statistical Areas - 25 different colors
export const getAreaColor = (stat2022) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5',
    '#F1948A', '#85C1E9', '#73C6B6', '#F7DC6F', '#BB8FCE',
    '#EC7063', '#5DADE2', '#58D68D', '#F4D03F', '#AF7AC5'
  ]
  return colors[(stat2022 - 1) % colors.length]
}

// Layer colors
export const layerColors = {
  statisticalAreas: {
    fill: '#4A90E2',
    stroke: '#2E5C8A',
    selected: '#FF6B6B',
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
    weight: isSelected ? 3 : 2,
    opacity: 0.8,
    fillOpacity: isSelected ? 0.4 : 0.2,
  }
}

