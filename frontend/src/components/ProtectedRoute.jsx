/**
 * Wrap routes (or sections) that require sign-in. The public map stays at `/`.
 *
 * Example (future):
 *   <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" aria-hidden />
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
