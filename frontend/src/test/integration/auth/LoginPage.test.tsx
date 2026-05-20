import { describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import { TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { server } from '@/test/setup/server'
import { getStoredAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'
import { delay, http, HttpResponse } from 'msw'

function LoginRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/map" element={<h1>Map destination</h1>} />
      <Route path="/municipality" element={<h1>Municipality destination</h1>} />
    </Routes>
  )
}

describe('LoginPage integration', () => {
  it('logs in successfully, persists token, and redirects to /map by default', async () => {
    const view = renderWithProviders(<LoginRoutes />, { route: '/login' })

    await waitFor(() => {
      expect(within(view.container).getByLabelText('דוא"ל')).toBeInTheDocument()
    })

    await userEvent.type(within(view.container).getByLabelText('דוא"ל'), 'editor@example.com')
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), 'password123')
    await userEvent.click(within(view.container).getByRole('button', { name: 'התחברות' }))

    await waitFor(() => {
      expect(getStoredAuthToken()).toBe(TEST_ACCESS_TOKEN)
      expect(within(view.container).getByRole('heading', { name: 'Map destination' })).toBeInTheDocument()
    })
  })

  it('redirects to the protected route from location.state.from after login', async () => {
    const view = renderWithProviders(<LoginRoutes />, {
      routerProps: {
        initialEntries: [{ pathname: '/login', state: { from: { pathname: '/municipality' } } }],
      },
    })

    await waitFor(() => {
      expect(within(view.container).getByLabelText('דוא"ל')).toBeInTheDocument()
    })

    await userEvent.type(within(view.container).getByLabelText('דוא"ל'), 'editor@example.com')
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), 'password123')
    await userEvent.click(within(view.container).getByRole('button', { name: 'התחברות' }))

    await waitFor(() => {
      expect(
        within(view.container).getByRole('heading', { name: 'Municipality destination' }),
      ).toBeInTheDocument()
    })
  })

  it('shows client-side validation errors for invalid form input', async () => {
    const view = renderWithProviders(<LoginRoutes />, { route: '/login' })

    await waitFor(() => {
      expect(within(view.container).getByRole('button', { name: 'התחברות' })).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'התחברות' }))

    const alerts = await within(view.container).findAllByRole('alert')
    expect(alerts.some((el) => el.textContent?.includes('שדה חובה'))).toBe(true)
    expect(within(view.container).getByRole('form', { name: 'התחברות' })).toBeInTheDocument()
  })

  it('shows server error for invalid credentials', async () => {
    const view = renderWithProviders(<LoginRoutes />, { route: '/login' })

    await userEvent.type(within(view.container).getByLabelText('דוא"ל'), 'editor@example.com')
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), 'wrong-password')
    await userEvent.click(within(view.container).getByRole('button', { name: 'התחברות' }))

    expect(await within(view.container).findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    )
    expect(getStoredAuthToken()).toBeNull()
  })

  it('shows a network error message when login request fails without a response', async () => {
    server.use(
      http.post('http://localhost:8000/api/auth/login', () => HttpResponse.error()),
    )

    const view = renderWithProviders(<LoginRoutes />, { route: '/login' })

    await userEvent.type(within(view.container).getByLabelText('דוא"ל'), 'editor@example.com')
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), 'password123')
    await userEvent.click(within(view.container).getByRole('button', { name: 'התחברות' }))

    await waitFor(() => {
      expect(within(view.container).getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows submitting state while login is in progress', async () => {
    server.use(
      http.post('http://localhost:8000/api/auth/login', async ({ request }) => {
        await delay(100)
        const body = (await request.json()) as { email?: string }
        return HttpResponse.json({
          access_token: TEST_ACCESS_TOKEN,
          user: { email: body.email, role: 'editor' },
        })
      }),
    )

    const view = renderWithProviders(<LoginRoutes />, { route: '/login' })

    await userEvent.type(within(view.container).getByLabelText('דוא"ל'), 'editor@example.com')
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), 'password123')
    await userEvent.click(within(view.container).getByRole('button', { name: 'התחברות' }))

    expect(within(view.container).getByRole('button', { name: 'מתחבר...' })).toBeDisabled()

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'Map destination' })).toBeInTheDocument()
    })
  })
})
