# CityStrata Frontend

React + Leaflet frontend application for the Eilat Evacuation Mapping System.

## Features

- **Interactive Map**: OpenStreetMap tiles centered on Eilat
- **Statistical Areas Layer**: Display 25 polygons with different colors
- **Point Layers**: Educational institutions, Airbnb listings, restaurants, and coffee shops
- **Layer Controls**: Toggle visibility of each layer
- **Filters**: Filter resources by area, capacity, rating, price, etc.
- **Area Details**: Click on areas to see detailed statistics
- **Evacuation Planner**: Analyze evacuation capacity vs. need

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file (if not exists):

```
VITE_API_URL=http://localhost:8000
```

3. Start development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
frontend/
├── src/
│   ├── App.jsx                 # Main app component
│   ├── main.jsx                # Entry point
│   ├── components/
│   │   ├── Map/                # Map components
│   │   ├── Sidebar/            # Sidebar components
│   │   └── UI/                 # UI components
│   ├── services/
│   │   └── api.js              # API client
│   ├── hooks/
│   │   └── useMapData.js       # Data fetching hooks
│   └── utils/
│       ├── colors.js           # Color schemes
│       └── formatters.js       # Formatting utilities
├── package.json
└── vite.config.js
```

## Usage

1. **View Statistical Areas**: The map loads with all 25 statistical areas displayed
2. **Toggle Layers**: Use the sidebar to show/hide different resource layers
3. **Filter Resources**: Go to the Filters tab to filter by area, capacity, rating, etc.
4. **View Area Details**: Click on any statistical area polygon to see statistics
5. **Evacuation Analysis**: Use the Evacuation tab to select areas and analyze capacity

## API Integration

The frontend communicates with the FastAPI backend running on `http://localhost:8000` (configurable via `VITE_API_URL`).

All API endpoints return GeoJSON FeatureCollection format for easy integration with Leaflet.

## Technologies

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **React Leaflet**: React bindings for Leaflet
- **Leaflet**: Interactive maps
- **Axios**: HTTP client

## Development

- Hot module replacement (HMR) enabled
- Fast refresh for React components
- Automatic API URL configuration via environment variables
