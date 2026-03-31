import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MapApp from './MapApp'

/** Map is public; use <ProtectedRoute> on future routes that require sign-in. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/" element={<MapApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
