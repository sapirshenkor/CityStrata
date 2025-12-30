import { useState } from 'react'
import './FilterPanel.css'

function FilterPanel({ filters, onUpdateFilters }) {
  const [localFilters, setLocalFilters] = useState(filters)

  const updateFilter = (category, key, value) => {
    const newFilters = {
      ...localFilters,
      [category]: {
        ...localFilters[category],
        [key]: value || undefined,
      },
    }
    setLocalFilters(newFilters)
    onUpdateFilters(newFilters)
  }

  return (
    <div className="filter-panel">
      <h2>Filters</h2>

      <div className="filter-section">
        <h3>Institutions</h3>
        <div className="filter-group">
          <label>
            Area:
            <input
              type="number"
              placeholder="Area code"
              value={localFilters.institutions.area || ''}
              onChange={(e) =>
                updateFilter('institutions', 'area', e.target.value ? parseInt(e.target.value) : null)
              }
            />
          </label>
          <label>
            Phase:
            <input
              type="text"
              placeholder="e.g., Elementary"
              value={localFilters.institutions.phase || ''}
              onChange={(e) => updateFilter('institutions', 'phase', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="filter-section">
        <h3>Airbnb</h3>
        <div className="filter-group">
          <label>
            Area:
            <input
              type="number"
              placeholder="Area code"
              value={localFilters.airbnb.area || ''}
              onChange={(e) =>
                updateFilter('airbnb', 'area', e.target.value ? parseInt(e.target.value) : null)
              }
            />
          </label>
          <label>
            Min Capacity:
            <input
              type="number"
              placeholder="e.g., 4"
              value={localFilters.airbnb.min_capacity || ''}
              onChange={(e) =>
                updateFilter('airbnb', 'min_capacity', e.target.value ? parseInt(e.target.value) : null)
              }
            />
          </label>
          <label>
            Min Rating:
            <input
              type="number"
              step="0.1"
              placeholder="e.g., 4.0"
              value={localFilters.airbnb.min_rating || ''}
              onChange={(e) =>
                updateFilter('airbnb', 'min_rating', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </label>
          <label>
            Max Price:
            <input
              type="number"
              placeholder="ILS per night"
              value={localFilters.airbnb.max_price || ''}
              onChange={(e) =>
                updateFilter('airbnb', 'max_price', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </label>
        </div>
      </div>

      <div className="filter-section">
        <h3>Restaurants</h3>
        <div className="filter-group">
          <label>
            Area:
            <input
              type="number"
              placeholder="Area code"
              value={localFilters.restaurants.area || ''}
              onChange={(e) =>
                updateFilter('restaurants', 'area', e.target.value ? parseInt(e.target.value) : null)
              }
            />
          </label>
          <label>
            Category:
            <input
              type="text"
              placeholder="e.g., Italian"
              value={localFilters.restaurants.category || ''}
              onChange={(e) => updateFilter('restaurants', 'category', e.target.value)}
            />
          </label>
          <label>
            Min Score:
            <input
              type="number"
              step="0.1"
              placeholder="e.g., 4.0"
              value={localFilters.restaurants.min_score || ''}
              onChange={(e) =>
                updateFilter('restaurants', 'min_score', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </label>
        </div>
      </div>

      <div className="filter-section">
        <h3>Coffee Shops</h3>
        <div className="filter-group">
          <label>
            Area:
            <input
              type="number"
              placeholder="Area code"
              value={localFilters.coffeeShops.area || ''}
              onChange={(e) =>
                updateFilter('coffeeShops', 'area', e.target.value ? parseInt(e.target.value) : null)
              }
            />
          </label>
          <label>
            Min Score:
            <input
              type="number"
              step="0.1"
              placeholder="e.g., 4.0"
              value={localFilters.coffeeShops.min_score || ''}
              onChange={(e) =>
                updateFilter('coffeeShops', 'min_score', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </label>
        </div>
      </div>
    </div>
  )
}

export default FilterPanel

