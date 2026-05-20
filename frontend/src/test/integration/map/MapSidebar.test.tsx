import { describe, expect, it, vi } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapSidebar } from '@/components/Sidebar/MapSidebar'
import { meHandlerAs, TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { makeAuthUser, makeVisitorUser } from '@/test/setup/fixtures/users'
import { server } from '@/test/setup/server'
import { seedAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'

vi.mock('@/components/EvacueeProfileForm', () => ({
  default: () => <div>Mock family form</div>,
}))
vi.mock('@/components/CommunityForm/CommunityForm', () => ({
  default: () => <div>Mock community form</div>,
}))
vi.mock('@/components/Recommendations/RecommendationsPanel', () => ({
  default: () => <div>Mock recommendations panel</div>,
}))
vi.mock('@/components/CommunityProfiles/CommunityProfilesPanel', () => ({
  default: () => <div>Mock community profiles panel</div>,
}))

const sidebarProps = {
  selectedRecommendation: null,
  onSelectRecommendation: vi.fn(),
}

function renderSidebar(role: 'guest' | 'visitor' | 'editor' = 'guest') {
  if (role === 'guest') {
    return renderWithProviders(<MapSidebar {...sidebarProps} />)
  }

  const user =
    role === 'visitor'
      ? makeVisitorUser()
      : makeAuthUser({ role: 'editor', first_name: 'Ops', last_name: 'Editor' })

  server.use(meHandlerAs(user))
  seedAuthToken(TEST_ACCESS_TOKEN)
  return renderWithProviders(<MapSidebar {...sidebarProps} />)
}

describe('MapSidebar role behavior', () => {
  it('shows public listings for guests without operational tabs', async () => {
    const view = renderSidebar('guest')

    await waitFor(() => {
      expect(within(view.container).getByText('מאגר מקומות לינה')).toBeInTheDocument()
    })

    expect(within(view.container).queryByRole('tab', { name: 'משפחה' })).toBeNull()
    expect(within(view.container).queryByRole('tab', { name: 'מקומות לינה' })).toBeNull()
    expect(within(view.container).queryByRole('tab', { name: 'קהילה' })).toBeNull()
  })

  it('shows family and family-recommendation tabs for visitors only', async () => {
    const view = renderSidebar('visitor')

    await waitFor(() => {
      expect(within(view.container).getByRole('tab', { name: 'משפחה' })).toBeInTheDocument()
      expect(within(view.container).getByRole('tab', { name: 'המלצות למשפחה' })).toBeInTheDocument()
    })

    expect(within(view.container).queryByRole('tab', { name: 'מקומות לינה' })).toBeNull()
    expect(within(view.container).queryByRole('tab', { name: 'קהילה' })).toBeNull()
    expect(within(view.container).queryByRole('tab', { name: 'המלצות לקהילה' })).toBeNull()
  })

  it('shows all operational tabs for editor/admin roles', async () => {
    const view = renderSidebar('editor')

    await waitFor(() => {
      expect(within(view.container).getByRole('tab', { name: 'משפחה' })).toBeInTheDocument()
      expect(within(view.container).getByRole('tab', { name: 'מקומות לינה' })).toBeInTheDocument()
      expect(within(view.container).getByRole('tab', { name: 'קהילה' })).toBeInTheDocument()
      expect(within(view.container).getByRole('tab', { name: 'המלצות למשפחה' })).toBeInTheDocument()
      expect(within(view.container).getByRole('tab', { name: 'המלצות לקהילה' })).toBeInTheDocument()
    })
  })

  it('switches tab content for role-permitted actions', async () => {
    const view = renderSidebar('editor')

    await waitFor(() => {
      expect(within(view.container).getByText('Mock family form')).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('tab', { name: 'המלצות למשפחה' }))

    await waitFor(() => {
      expect(within(view.container).getByText('Mock recommendations panel')).toBeInTheDocument()
    })
  })

  it('renders agent thinking overlay without blocking sidebar structure', async () => {
    const view = renderWithProviders(
      <MapSidebar
        {...sidebarProps}
        agentThinkingOverlay={<div role="status">Agent thinking</div>}
      />,
    )

    await waitFor(() => {
      expect(within(view.container).getByRole('status')).toHaveTextContent('Agent thinking')
      expect(within(view.container).getByText('מאגר מקומות לינה')).toBeInTheDocument()
    })
  })
})
