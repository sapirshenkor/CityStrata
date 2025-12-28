import { useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

function LayerControls() {
  const map = useMap()

  useEffect(() => {
    // Add custom CSS for area labels
    const style = document.createElement('style')
    style.textContent = `
      .area-label {
        background: transparent !important;
        border: none !important;
      }
      .area-label-text {
        background: rgba(255, 255, 255, 0.9);
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        font-size: 12px;
        border: 1px solid #333;
        text-align: center;
      }
      .custom-marker {
        background: transparent !important;
        border: none !important;
      }
      .marker-icon {
        font-size: 24px;
        text-align: center;
        line-height: 30px;
      }
      .popup-content {
        min-width: 200px;
      }
      .popup-content h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
      }
      .popup-content p {
        margin: 4px 0;
        font-size: 14px;
      }
      .popup-content a {
        color: #4A90E2;
        text-decoration: none;
      }
      .popup-content a:hover {
        text-decoration: underline;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return null
}

export default LayerControls

