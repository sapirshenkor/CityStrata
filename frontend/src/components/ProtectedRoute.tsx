/**
 * Wrap routes (or sections) that require sign-in. The public map is at `/map`.
 *
 * Example (future):
 *   <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: string[] | null
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  allowedRoles = null,
  redirectTo = '/map',
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="text-sm">טוען...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = user.role ?? null
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to={redirectTo} replace />
    }
  }

  return children
}
