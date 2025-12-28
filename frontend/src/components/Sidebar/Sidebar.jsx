import { useState } from 'react'
import AreaDetails from './AreaDetails'
import FilterPanel from './FilterPanel'
import EvacuationPlanner from './EvacuationPlanner'
import './Sidebar.css'

function Sidebar({
  selectedArea,
  onSelectArea,
  areaFilter,
  onAreaFilterChange,
  layerVisibility,
  onToggleLayer,
  filters,
  onUpdateFilters,
}) {
  const [activeTab, setActiveTab] = useState('layers')

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>CityStrata</h1>
        <p className="subtitle">Eilat Evacuation Mapping</p>
      </div>

      <div className="sidebar-tabs">
        <button
          className={activeTab === 'layers' ? 'active' : ''}
          onClick={() => setActiveTab('layers')}
        >
          Layers
        </button>
        <button
          className={activeTab === 'filters' ? 'active' : ''}
          onClick={() => setActiveTab('filters')}
        >
          Filters
        </button>
        <button
          className={activeTab === 'evacuation' ? 'active' : ''}
          onClick={() => setActiveTab('evacuation')}
        >
          Evacuation
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'layers' && (
          <>
            <div className="area-filter-section">
              <h2>Area Filter</h2>
              <div className="area-filter-controls">
                <input
                  type="number"
                  min="1"
                  max="25"
                  placeholder="Enter area (1-25)"
                  value={areaFilter || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    onAreaFilterChange(value)
                    // Auto-select the area when filtering
                    if (value) {
                      onSelectArea(value)
                    }
                  }}
                  className="area-filter-input"
                />
                {areaFilter && (
                  <button
                    onClick={() => {
                      onAreaFilterChange(null)
                      onSelectArea(null)
                    }}
                    className="clear-filter-button"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              {areaFilter && (
                <p className="filter-info">
                  Showing only Area {areaFilter}. All layers are filtered to this area.
                </p>
              )}
            </div>

            <div className="layer-controls">
              <h2>Layer Visibility</h2>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.statisticalAreas}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      statisticalAreas: e.target.checked,
                    })
                  }
                />
                <span>Statistical Areas</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.institutions}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      institutions: e.target.checked,
                    })
                  }
                />
                <span>Educational Institutions</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.airbnb}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      airbnb: e.target.checked,
                    })
                  }
                />
                <span>Airbnb Listings</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.restaurants}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      restaurants: e.target.checked,
                    })
                  }
                />
                <span>Restaurants</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.coffeeShops}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      coffeeShops: e.target.checked,
                    })
                  }
                />
                <span>Coffee Shops</span>
              </label>
            </div>

            {selectedArea && (
              <AreaDetails stat2022={selectedArea} onClose={() => onSelectArea(null)} />
            )}
          </>
        )}

        {activeTab === 'filters' && (
          <FilterPanel filters={filters} onUpdateFilters={onUpdateFilters} />
        )}

        {activeTab === 'evacuation' && <EvacuationPlanner />}
      </div>
    </div>
  )
}

export default Sidebar

