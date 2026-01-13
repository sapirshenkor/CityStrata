/**
 * Formatting utilities for numbers, dates, etc.
 */

export const formatNumber = (num) => {
  if (num === null || num === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US').format(num)
}

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatArea = (areaM2) => {
  if (!areaM2) return 'N/A'
  const hectares = areaM2 / 10000
  if (hectares >= 1) {
    return `${formatNumber(hectares.toFixed(2))} ha`
  }
  return `${formatNumber(areaM2.toFixed(0))} m²`
}

export const formatDistance = (meters) => {
  if (!meters) return 'N/A'
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${Math.round(meters)} m`
}

export const formatRating = (rating) => {
  if (rating === null || rating === undefined) return 'N/A'
  return rating.toFixed(1)
}

