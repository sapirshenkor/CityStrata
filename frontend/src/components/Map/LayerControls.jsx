import { useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

function LayerControls() {
  const map = useMap()

  useEffect(() => {
    // Add custom CSS for area labels
    const style = document.createElement('style')
    style.textContent = `
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

