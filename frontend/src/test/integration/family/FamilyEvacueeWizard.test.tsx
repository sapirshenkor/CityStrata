import { describe, expect, it } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { API_BASE_URL } from '@/config/apiBaseUrl'
import FamilyEvacueeWizard from '@/family_portal/FamilyEvacueeWizard'
import { meHandlerAs, TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { createFamilyProfileCapture } from '@/test/setup/handlers/family.handlers'
import { makeVisitorUser } from '@/test/setup/fixtures/users'
import { server } from '@/test/setup/server'
import { seedAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'
import {
  advanceThroughRemainingSteps,
  fillStep1Contact,
} from '@/test/utils/wizardFormHelpers'
import { http, HttpResponse } from 'msw'

function WizardRoutes() {
  return (
    <Routes>
      <Route path="/family/profile/new" element={<FamilyEvacueeWizard />} />
      <Route path="/family" element={<h1>Family dashboard</h1>} />
    </Routes>
  )
}

function renderAuthenticatedWizard() {
  server.use(meHandlerAs(makeVisitorUser()))
  seedAuthToken(TEST_ACCESS_TOKEN)
  return renderWithProviders(<WizardRoutes />, { route: '/family/profile/new' })
}

describe('FamilyEvacueeWizard integration', () => {
  it('blocks progression when step 1 contact fields are invalid', async () => {
    const view = renderAuthenticatedWizard()

    await waitFor(() => {
      expect(within(view.container).getByText('פרטי קשר')).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'הבא' }))

    const errors = await within(view.container).findAllByText('שדה חובה')
    expect(errors.length).toBeGreaterThan(0)
    expect(within(view.container).getByText('פרטי קשר')).toBeInTheDocument()
    expect(within(view.container).queryByText('הרכב משפחה')).not.toBeInTheDocument()
  })

  it('advances from step 1 to step 2 when contact fields are valid', async () => {
    const view = renderAuthenticatedWizard()

    await waitFor(() => {
      expect(within(view.container).getByText('פרטי קשר')).toBeInTheDocument()
    })

    await fillStep1Contact(view.container)
    await userEvent.click(within(view.container).getByRole('button', { name: 'הבא' }))

    await waitFor(() => {
      expect(within(view.container).getByText('הרכב משפחה')).toBeInTheDocument()
      expect(within(view.container).getByText(/שלב 2 מתוך 7/)).toBeInTheDocument()
    })
  })

  it('submits a new profile and navigates to the family dashboard', async () => {
    const capture = createFamilyProfileCapture()
    server.use(capture.handler)

    const view = renderAuthenticatedWizard()

    await waitFor(() => {
      expect(within(view.container).getByText('פרטי קשר')).toBeInTheDocument()
    })

    await fillStep1Contact(view.container)
    await userEvent.click(within(view.container).getByRole('button', { name: 'הבא' }))
    await advanceThroughRemainingSteps(view.container, 5)

    await waitFor(() => {
      expect(within(view.container).getByText('מידע נוסף')).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'שליחה' }))

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'Family dashboard' })).toBeInTheDocument()
    })

    expect(capture.getLastPayload()).toMatchObject({
      family_name: 'Cohen',
      contact_email: 'dana@example.com',
      city_name: 'Eilat',
      total_people: 1,
      accommodation_preference: 'airbnb',
    })
  })

  it('shows a server error when profile creation fails', async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/family/me/profiles`, () =>
        HttpResponse.json({ detail: 'פרופיל לא תקין' }, { status: 422 }),
      ),
    )

    const view = renderAuthenticatedWizard()

    await waitFor(() => {
      expect(within(view.container).getByText('פרטי קשר')).toBeInTheDocument()
    })

    await fillStep1Contact(view.container)
    await userEvent.click(within(view.container).getByRole('button', { name: 'הבא' }))
    await advanceThroughRemainingSteps(view.container, 5)
    await userEvent.click(within(view.container).getByRole('button', { name: 'שליחה' }))

    expect(await within(view.container).findByText('פרופיל לא תקין')).toBeInTheDocument()
    expect(within(view.container).queryByRole('heading', { name: 'Family dashboard' })).toBeNull()
  })

  it('allows navigating back to a previous step', async () => {
    const view = renderAuthenticatedWizard()

    await fillStep1Contact(view.container)
    await userEvent.click(within(view.container).getByRole('button', { name: 'הבא' }))

    await waitFor(() => {
      expect(within(view.container).getByText('הרכב משפחה')).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'חזור' }))

    await waitFor(() => {
      expect(within(view.container).getByText('פרטי קשר')).toBeInTheDocument()
    })
  })
})
