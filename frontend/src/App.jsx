import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import LandingPage from './pages/LandingPage'
import MapApp from './MapApp'
import ProtectedRoute from './components/ProtectedRoute'

const MunicipalityDashboard = lazy(() => import('./user_dashboard/DashboardContainer'))
const HotelManagementPage = lazy(() => import('./hotels_management/HotelManagementPage'))
const PointOfInterestManagement = lazy(() => import('./poi_management/PointOfInterestManagement'))
const FamilyDashboard = lazy(() => import('./family_portal/FamilyDashboard'))
const FamilyEvacueeWizard = lazy(() => import('./family_portal/FamilyEvacueeWizard'))
const PropertyListingWizard = lazy(() => import('./family_portal/PropertyListingWizard'))
const PropertyListingDetails = lazy(() => import('./family_portal/PropertyListingDetails'))

/** Landing and map are public; wrap authenticated areas with <ProtectedRoute>. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/map" element={<MapApp />} />
      <Route
        path="/municipality"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  טוען לוח בקרה...
                </div>
              }
            >
              <MunicipalityDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/municipality/hotels"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  טוען...
                </div>
              }
            >
              <HotelManagementPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/municipality/poi"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  טוען...
                </div>
              }
            >
              <PointOfInterestManagement />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family"
        element={
          <ProtectedRoute allowedRoles={['visitor']} redirectTo="/map">
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  טוען...
                </div>
              }
            >
              <FamilyDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/property/:listingId"
        element={
          <ProtectedRoute allowedRoles={['visitor']} redirectTo="/map">
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  Loading…
                </div>
              }
            >
              <PropertyListingDetails />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/property/new"
        element={
          <ProtectedRoute allowedRoles={['visitor']} redirectTo="/map">
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  Loading…
                </div>
              }
            >
              <PropertyListingWizard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/profile/new"
        element={
          <ProtectedRoute allowedRoles={['visitor']} redirectTo="/map">
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  טוען...
                </div>
              }
            >
              <FamilyEvacueeWizard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/profile/:uuid/edit"
        element={
          <ProtectedRoute allowedRoles={['visitor']} redirectTo="/map">
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                  טוען...
                </div>
              }
            >
              <FamilyEvacueeWizard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
