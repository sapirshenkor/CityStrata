import { useAreaSummary } from '../../hooks/useMapData'
import { formatArea, formatNumber } from '../../utils/formatters'
import './AreaDetails.css'

function AreaDetails({ stat2022, onClose }) {
  const { data, loading, error } = useAreaSummary(stat2022)

  return (
    <div className="area-details">
      <div className="area-details-header">
        <h2>Area {stat2022}</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      {loading && <div className="loading">Loading statistics...</div>}
      {error && <div className="error">Error loading data: {error}</div>}

      {data && (
        <div className="area-stats">
          <div className="stat-item">
            <span className="stat-label">Area:</span>
            <span className="stat-value">{formatArea(data.area_m2)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Institutions:</span>
            <span className="stat-value">{formatNumber(data.institutions_count)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Airbnb Listings:</span>
            <span className="stat-value">{formatNumber(data.airbnb_count)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Total Capacity:</span>
            <span className="stat-value">
              {formatNumber(data.total_airbnb_capacity)} people
            </span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Restaurants:</span>
            <span className="stat-value">{formatNumber(data.restaurants_count)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Coffee Shops:</span>
            <span className="stat-value">{formatNumber(data.coffee_shops_count)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default AreaDetails

