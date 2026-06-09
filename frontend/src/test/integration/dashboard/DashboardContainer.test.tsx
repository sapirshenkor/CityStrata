import { describe, expect, it, vi } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { API_BASE_URL } from '@/config/apiBaseUrl'
import DashboardContainer from '@/user_dashboard/DashboardContainer'
import {
  makeEmptyFeatureCollection,
  makeStatisticalAreasCollection,
} from '@/test/setup/fixtures/geojson'
import { server } from '@/test/setup/server'
import { renderWithProviders } from '@/test/utils/renderWithProviders'
import { http, HttpResponse } from 'msw'

vi.mock('@/user_dashboard/MapView', () => ({
  MapView: ({
    loading,
    errorMessage,
    onRetry,
  }: {
    loading?: boolean
    errorMessage?: string | null
    onRetry?: () => void
  }) => (
    <div>
      {loading ? <p>Map loading</p> : null}
      {errorMessage ? (
        <div role="alert">
          {errorMessage}
          {onRetry ? (
            <button type="button" onClick={() => onRetry()}>
              Retry map
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && !errorMessage ? <p>Mock dashboard map</p> : null}
    </div>
  ),
}))

describe('DashboardContainer integration', () => {
  it('renders KPI values after dashboard data loads', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/statistical-areas`, () =>
        HttpResponse.json(makeStatisticalAreasCollection(1)),
      ),
    )

    const view = renderWithProviders(<DashboardContainer />)

    await waitFor(() => {
      expect(within(view.container).getByText('3')).toBeInTheDocument()
      expect(within(view.container).getByText('Mock dashboard map')).toBeInTheDocument()
    })

    expect(within(view.container).getByText('סקירת עיר')).toBeInTheDocument()
  })

  it('shows ApiErrorBanner with retry when metrics fetch fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/hotels`, () =>
        HttpResponse.json({ detail: 'שגיאת שרת במלונות' }, { status: 500 }),
      ),
    )

    const view = renderWithProviders(<DashboardContainer />)

    const alert = await within(view.container).findByRole('alert')
    expect(alert).toHaveTextContent('שגיאת שרת במלונות')
    expect(within(view.container).getByRole('button', { name: 'נסו שוב' })).toBeInTheDocument()
  })

  it('retries metrics fetch when ApiErrorBanner retry is clicked', async () => {
    let hotelsCalls = 0

    server.use(
      http.get(`${API_BASE_URL}/api/hotels`, () => {
        hotelsCalls += 1
        if (hotelsCalls === 1) {
          return HttpResponse.json({ detail: 'שגיאה זמנית' }, { status: 500 })
        }
        return HttpResponse.json({ type: 'FeatureCollection', features: [] })
      }),
    )

    const view = renderWithProviders(<DashboardContainer />)

    const retryButton = await within(view.container).findByRole('button', { name: 'נסו שוב' })
    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(hotelsCalls).toBeGreaterThan(1)
    })
  })

  it('shows map error alert in MapView when areas fetch fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/statistical-areas`, () =>
        HttpResponse.json({ detail: 'שגיאת גבולות' }, { status: 500 }),
      ),
    )

    const view = renderWithProviders(<DashboardContainer />)

    expect(await within(view.container).findByRole('alert')).toHaveTextContent('שגיאת גבולות')
  })

  it('shows empty insights messaging when no statistical areas exist', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/statistical-areas`, () =>
        HttpResponse.json(makeEmptyFeatureCollection()),
      ),
    )

    const view = renderWithProviders(<DashboardContainer />)

    expect(
      await within(view.container).findByText(/אין גבולות אזורים סטטיסטיים זמינים/),
    ).toBeInTheDocument()
  })
})
