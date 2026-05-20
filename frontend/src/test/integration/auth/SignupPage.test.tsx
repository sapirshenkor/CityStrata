import { describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import SignupPage from '@/pages/SignupPage'
import { TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { server } from '@/test/setup/server'
import { getStoredAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'
import { delay, http, HttpResponse } from 'msw'

function SignupRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/map" element={<h1>Map destination</h1>} />
    </Routes>
  )
}

const validSignup = {
  first_name: 'Dana',
  last_name: 'Cohen',
  email: 'dana@example.com',
  password: 'password123',
}

describe('SignupPage integration', () => {
  it('signs up, auto-logs in, persists token, and redirects to /map', async () => {
    const view = renderWithProviders(<SignupRoutes />, { route: '/signup' })

    await waitFor(() => {
      expect(within(view.container).getByRole('form', { name: 'יצירת חשבון' })).toBeInTheDocument()
    })

    await userEvent.type(within(view.container).getByLabelText('שם פרטי'), validSignup.first_name)
    await userEvent.type(within(view.container).getByLabelText('שם משפחה'), validSignup.last_name)
    await userEvent.type(within(view.container).getByLabelText('דוא"ל עבודה'), validSignup.email)
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), validSignup.password)
    await userEvent.click(within(view.container).getByRole('button', { name: 'יצירת חשבון' }))

    await waitFor(() => {
      expect(getStoredAuthToken()).toBe(TEST_ACCESS_TOKEN)
      expect(within(view.container).getByRole('heading', { name: 'Map destination' })).toBeInTheDocument()
    })
  })

  it('shows validation errors for missing required fields and short password', async () => {
    const view = renderWithProviders(<SignupRoutes />, { route: '/signup' })

    await userEvent.type(within(view.container).getByLabelText('סיסמה'), 'short')
    await userEvent.click(within(view.container).getByRole('button', { name: 'יצירת חשבון' }))

    const alerts = await within(view.container).findAllByRole('alert')
    expect(alerts.some((el) => el.textContent?.includes('שדה חובה'))).toBe(true)
    expect(alerts.some((el) => el.textContent?.includes('לפחות 8 תווים'))).toBe(true)
  })

  it('shows API validation errors from FastAPI detail arrays', async () => {
    server.use(
      http.post('http://localhost:8000/api/auth/signup', () =>
        HttpResponse.json(
          { detail: [{ msg: 'דוא"ל כבר קיים במערכת' }] },
          { status: 422 },
        ),
      ),
    )

    const view = renderWithProviders(<SignupRoutes />, { route: '/signup' })

    await userEvent.type(within(view.container).getByLabelText('שם פרטי'), validSignup.first_name)
    await userEvent.type(within(view.container).getByLabelText('שם משפחה'), validSignup.last_name)
    await userEvent.type(within(view.container).getByLabelText('דוא"ל עבודה'), validSignup.email)
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), validSignup.password)
    await userEvent.click(within(view.container).getByRole('button', { name: 'יצירת חשבון' }))

    expect(await within(view.container).findByRole('alert')).toHaveTextContent(
      'דוא"ל כבר קיים במערכת',
    )
  })

  it('shows submitting state while signup and auto-login are in progress', async () => {
    server.use(
      http.post('http://localhost:8000/api/auth/signup', async () => {
        await delay(80)
        return HttpResponse.json({ id: '11111111-1111-4111-8111-111111111111' }, { status: 201 })
      }),
      http.post('http://localhost:8000/api/auth/login', async () => {
        await delay(80)
        return HttpResponse.json({
          access_token: TEST_ACCESS_TOKEN,
          user: { email: validSignup.email, role: 'editor' },
        })
      }),
    )

    const view = renderWithProviders(<SignupRoutes />, { route: '/signup' })

    await userEvent.type(within(view.container).getByLabelText('שם פרטי'), validSignup.first_name)
    await userEvent.type(within(view.container).getByLabelText('שם משפחה'), validSignup.last_name)
    await userEvent.type(within(view.container).getByLabelText('דוא"ל עבודה'), validSignup.email)
    await userEvent.type(within(view.container).getByLabelText('סיסמה'), validSignup.password)
    await userEvent.click(within(view.container).getByRole('button', { name: 'יצירת חשבון' }))

    expect(within(view.container).getByRole('button', { name: 'יוצר חשבון...' })).toBeDisabled()

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'Map destination' })).toBeInTheDocument()
    })
  })
})
