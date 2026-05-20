import { describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserBar from '@/components/UserBar'
import { meHandlerAs, TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { makeAuthUser, makeVisitorUser } from '@/test/setup/fixtures/users'
import { server } from '@/test/setup/server'
import { getStoredAuthToken, seedAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'

describe('UserBar', () => {
  it('shows guest actions when no authenticated user is available', async () => {
    const view = renderWithProviders(<UserBar />)

    await waitFor(() => {
      expect(within(view.container).getByText('אורח')).toBeInTheDocument()
    })

    expect(within(view.container).getByRole('link', { name: 'התחברות' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(within(view.container).getByRole('link', { name: 'הרשמה' })).toHaveAttribute(
      'href',
      '/signup',
    )
  })

  it('shows visitor navigation to the family portal', async () => {
    server.use(meHandlerAs(makeVisitorUser()))
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<UserBar />)

    await waitFor(() => {
      expect(within(view.container).getByText('visitor')).toBeInTheDocument()
    })

    expect(within(view.container).getByRole('link', { name: 'פורטל משפחה' })).toHaveAttribute(
      'href',
      '/family',
    )
    expect(within(view.container).getByText('Family User')).toBeInTheDocument()
  })

  it('shows editor navigation to the municipality dashboard', async () => {
    server.use(meHandlerAs(makeAuthUser({ role: 'editor', first_name: 'Muni', last_name: 'User' })))
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<UserBar variant="onSurface" />)

    await waitFor(() => {
      expect(within(view.container).getByText('editor')).toBeInTheDocument()
    })

    expect(within(view.container).getByRole('link', { name: 'לוח בקרה' })).toHaveAttribute(
      'href',
      '/municipality',
    )
    expect(within(view.container).getByText('Muni User')).toBeInTheDocument()
  })

  it('clears the session when logout is clicked', async () => {
    server.use(meHandlerAs(makeAuthUser({ role: 'editor' })))
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<UserBar />)

    await waitFor(() => {
      expect(within(view.container).getByRole('button', { name: 'התנתקות' })).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'התנתקות' }))

    await waitFor(() => {
      expect(getStoredAuthToken()).toBeNull()
      expect(within(view.container).getByText('אורח')).toBeInTheDocument()
    })
  })
})
