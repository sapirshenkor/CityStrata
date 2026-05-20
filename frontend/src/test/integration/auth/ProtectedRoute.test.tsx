import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import { meHandlerAs, TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { makeAuthUser, makeVisitorUser } from '@/test/setup/fixtures/users'
import { server } from '@/test/setup/server'
import { seedAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'
import { delay, http, HttpResponse } from 'msw'

function LoginRouteProbe() {
  const location = useLocation()
  return (
    <div>
      <h1>Login page</h1>
      <span data-testid="from-path">
        {(location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? ''}
      </span>
    </div>
  )
}

function ProtectedFixture() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRouteProbe />} />
      <Route path="/map" element={<h1>Map page</h1>} />
      <Route
        path="/municipality"
        element={
          <ProtectedRoute allowedRoles={['editor', 'admin']} redirectTo="/map">
            <h1>Municipality dashboard</h1>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

describe('ProtectedRoute', () => {
  it('shows the loading state while auth bootstrap is in progress', async () => {
    server.use(
      http.get('http://localhost:8000/api/auth/me', async () => {
        await delay(50)
        return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
      }),
    )
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<ProtectedFixture />, { route: '/municipality' })

    expect(within(view.container).getByText('טוען...')).toBeInTheDocument()

    await waitFor(() => {
      expect(within(view.container).queryByText('טוען...')).not.toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users to login and preserves route state', async () => {
    const view = renderWithProviders(<ProtectedFixture />, { route: '/municipality' })

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'Login page' })).toBeInTheDocument()
      expect(within(view.container).getByTestId('from-path')).toHaveTextContent('/municipality')
    })
    expect(within(view.container).queryByRole('heading', { name: 'Municipality dashboard' })).toBeNull()
  })

  it('renders protected content for an allowed authenticated role', async () => {
    server.use(meHandlerAs(makeAuthUser({ role: 'editor' })))
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<ProtectedFixture />, { route: '/municipality' })

    await waitFor(() => {
      expect(
        within(view.container).getByRole('heading', { name: 'Municipality dashboard' }),
      ).toBeInTheDocument()
    })
  })

  it('redirects authenticated users with the wrong role to the configured fallback route', async () => {
    server.use(meHandlerAs(makeVisitorUser()))
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<ProtectedFixture />, { route: '/municipality' })

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'Map page' })).toBeInTheDocument()
    })
    expect(within(view.container).queryByRole('heading', { name: 'Municipality dashboard' })).toBeNull()
  })
})
