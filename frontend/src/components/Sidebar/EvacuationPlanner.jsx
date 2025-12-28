import { useState } from 'react'
import { analyzeEvacuation } from '../../services/api'
import { formatNumber } from '../../utils/formatters'
import './EvacuationPlanner.css'

function EvacuationPlanner() {
  const [selectedAreas, setSelectedAreas] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [areaInput, setAreaInput] = useState('')

  const addArea = () => {
    const area = parseInt(areaInput.trim())
    if (area && !selectedAreas.includes(area)) {
      setSelectedAreas([...selectedAreas, area])
      setAreaInput('')
    }
  }

  const removeArea = (area) => {
    setSelectedAreas(selectedAreas.filter((a) => a !== area))
  }

  const handleAnalyze = async () => {
    if (selectedAreas.length === 0) {
      setError('Please select at least one area to evacuate')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await analyzeEvacuation({
        evacuate_areas: selectedAreas,
        scenario: 'emergency',
      })
      setAnalysis(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Error analyzing evacuation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="evacuation-planner">
      <h2>Evacuation Planner</h2>

      <div className="area-selector">
        <h3>Select Areas to Evacuate</h3>
        <div className="input-group">
          <input
            type="number"
            placeholder="Enter area code (1-25)"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addArea()}
            min="1"
            max="25"
          />
          <button onClick={addArea}>Add</button>
        </div>

        {selectedAreas.length > 0 && (
          <div className="selected-areas">
            {selectedAreas.map((area) => (
              <span key={area} className="area-tag">
                Area {area}
                <button onClick={() => removeArea(area)}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        className="analyze-button"
        onClick={handleAnalyze}
        disabled={loading || selectedAreas.length === 0}
      >
        {loading ? 'Analyzing...' : 'Analyze Evacuation'}
      </button>

      {error && <div className="error-message">{error}</div>}

      {analysis && (
        <div className="analysis-results">
          <h3>Analysis Results</h3>

          <div className="summary-stats">
            <div className="summary-item">
              <span className="summary-label">Total Need:</span>
              <span className="summary-value">{formatNumber(analysis.total_need)} people</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Capacity:</span>
              <span className="summary-value">{formatNumber(analysis.total_capacity)} people</span>
            </div>
            <div className={`summary-item ${analysis.capacity_deficit < 0 ? 'deficit' : 'surplus'}`}>
              <span className="summary-label">Capacity Status:</span>
              <span className="summary-value">
                {analysis.capacity_deficit < 0
                  ? `Deficit: ${formatNumber(Math.abs(analysis.capacity_deficit))}`
                  : `Surplus: ${formatNumber(analysis.capacity_deficit)}`}
              </span>
            </div>
          </div>

          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul>
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EvacuationPlanner

