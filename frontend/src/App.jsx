import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MapApp from './MapApp'
import ProtectedRoute from './components/ProtectedRoute'

const MunicipalityDashboard = lazy(() => import('./user_dashboard/DashboardContainer'))

/** Map is public; use <ProtectedRoute> on future routes that require sign-in. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/" element={<MapApp />} />
      <Route
        path="/municipality"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  Loading dashboard…
                </div>
              }
            >
              <MunicipalityDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
