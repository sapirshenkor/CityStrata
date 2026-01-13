import { useState } from 'react'
import AreaDetails from './AreaDetails'
import FilterPanel from './FilterPanel'
import EvacuationPlanner from './EvacuationPlanner'
import { useOSMFacilityTypes } from '../../hooks/useMapData'
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
  const [facilityTypeSearch, setFacilityTypeSearch] = useState('')
  const { data: facilityTypes } = useOSMFacilityTypes()

  const toggleFacilityType = (facilityType) => {
    const currentTypes = filters.osmFacilities?.facility_types || []
    const newTypes = currentTypes.includes(facilityType)
      ? currentTypes.filter(t => t !== facilityType)
      : [...currentTypes, facilityType]
    
    onUpdateFilters({
      ...filters,
      osmFacilities: {
        ...filters.osmFacilities,
        facility_types: newTypes.length > 0 ? newTypes : undefined,
      },
    })
  }

  const selectAllFacilityTypes = () => {
    if (facilityTypes && facilityTypes.length > 0) {
      const filteredTypes = facilityTypeSearch
        ? facilityTypes.filter(type => 
            type.toLowerCase().includes(facilityTypeSearch.toLowerCase())
          )
        : facilityTypes
      onUpdateFilters({
        ...filters,
        osmFacilities: {
          ...filters.osmFacilities,
          facility_types: filteredTypes,
        },
      })
    }
  }

  const deselectAllFacilityTypes = () => {
    onUpdateFilters({
      ...filters,
      osmFacilities: {
        ...filters.osmFacilities,
        facility_types: undefined,
      },
    })
  }

  const filteredFacilityTypes = facilityTypes?.filter(type =>
    type.toLowerCase().includes(facilityTypeSearch.toLowerCase())
  ) || []

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
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.hotels}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      hotels: e.target.checked,
                    })
                  }
                />
                <span>Hotels</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.matnasim}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      matnasim: e.target.checked,
                    })
                  }
                />
                <span>Matnasim</span>
              </label>
              <label className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layerVisibility.osmFacilities}
                  onChange={(e) =>
                    onToggleLayer({
                      ...layerVisibility,
                      osmFacilities: e.target.checked,
                    })
                  }
                />
                <span>OSM Facilities</span>
              </label>
            </div>

            {layerVisibility.osmFacilities && facilityTypes && facilityTypes.length > 0 && (
              <div className="osm-facility-types-section">
                <div className="osm-facility-types-header">
                  <h3>Select Facility Types</h3>
                  <div className="osm-facility-types-actions">
                    <button
                      type="button"
                      onClick={selectAllFacilityTypes}
                      className="osm-select-all-button"
                      title="Select all visible types"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllFacilityTypes}
                      className="osm-deselect-all-button"
                      title="Deselect all types"
                    >
                      None
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search facility types..."
                  value={facilityTypeSearch}
                  onChange={(e) => setFacilityTypeSearch(e.target.value)}
                  className="osm-facility-type-search"
                />
                {filteredFacilityTypes.length === 0 ? (
                  <div className="osm-no-results">No types found matching "{facilityTypeSearch}"</div>
                ) : (
                  <>
                    <div className="osm-facility-types-checkboxes">
                      {filteredFacilityTypes.map((type) => {
                        const isChecked = filters.osmFacilities?.facility_types?.includes(type) || false
                        return (
                          <label key={type} className="osm-facility-type-checkbox">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFacilityType(type)}
                            />
                            <span>{type}</span>
                          </label>
                        )
                      })}
                    </div>
                    {filters.osmFacilities?.facility_types?.length > 0 ? (
                      <div className="osm-selected-count">
                        {filters.osmFacilities.facility_types.length} type(s) selected
                      </div>
                    ) : (
                      <div className="osm-no-selection-message">
                        ⚠️ Select at least one type to see facilities
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

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

