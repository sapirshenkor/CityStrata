/**
 * Wrap routes (or sections) that require sign-in. The public map is at `/map`.
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f8f9fa] text-[#333]">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-[#667eea] border-t-transparent"
          aria-hidden
        />
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
