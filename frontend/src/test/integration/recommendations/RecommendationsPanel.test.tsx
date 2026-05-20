import { describe, expect, it, vi } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecommendationsPanel from '@/components/Recommendations/RecommendationsPanel'
import {
  makeOverviewRow,
} from '@/test/setup/fixtures/recommendations'
import {
  matchingFailureHandler,
  overviewEmptyHandler,
  overviewErrorHandler,
  overviewLoadingHandler,
} from '@/test/setup/handlers/recommendations.handlers'
import { server } from '@/test/setup/server'
import { renderWithProviders } from '@/test/utils/renderWithProviders'
import { http, HttpResponse } from 'msw'

const panelProps = {
  selectedRecommendation: null,
  onSelectRecommendation: vi.fn(),
  onFamilyMacroClusterFocus: vi.fn(),
  onRecommendationsProcessingChange: vi.fn(),
}

describe('RecommendationsPanel integration', () => {
  it('shows overview loading state', async () => {
    server.use(overviewLoadingHandler())

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    expect(within(view.container).getByText('טוען משפחות...')).toBeInTheDocument()

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'המלצות' })).toBeInTheDocument()
    })
  })

  it('shows empty state when no families exist', async () => {
    server.use(overviewEmptyHandler())

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    expect(await within(view.container).findByText('אין עדיין משפחות')).toBeInTheDocument()
  })

  it('shows API failure alert when overview fetch fails', async () => {
    server.use(overviewErrorHandler('שגיאת מסד נתונים'))

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    const alert = await within(view.container).findByRole('alert')
    expect(alert).toHaveTextContent('לא ניתן לטעון נתונים')
    expect(alert).toHaveTextContent(/500/)
  })

  it('renders overview rows and supports cluster filtering', async () => {
    server.use(
      http.get('http://localhost:8000/api/recommendations/overview', () =>
        HttpResponse.json([
          makeOverviewRow({ family_name: 'Cohen', cluster_number: 1 }),
          makeOverviewRow({
            profile_uuid: '22222222-2222-4222-8222-222222222222',
            family_name: 'Levi',
            cluster_number: 2,
            has_matching: true,
          }),
        ]),
      ),
    )

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    await waitFor(() => {
      expect(within(view.container).getByText('Cohen')).toBeInTheDocument()
      expect(within(view.container).getByText('Levi')).toBeInTheDocument()
    })

    await userEvent.selectOptions(
      within(view.container).getByLabelText('אשכול'),
      '1',
    )

    expect(within(view.container).getByText('Cohen')).toBeInTheDocument()
    expect(within(view.container).queryByText('Levi')).toBeNull()
  })

  it('selects a family row and shows detail placeholder', async () => {
    server.use(
      http.get('http://localhost:8000/api/recommendations/overview', () =>
        HttpResponse.json([
          makeOverviewRow({ family_name: 'Cohen', has_matching: true }),
        ]),
      ),
      http.get('http://localhost:8000/api/matching/result/:profileUuid', () =>
        HttpResponse.json({
          recommended_cluster_number: 1,
          cluster_name: 'Cluster A',
          confidence: 'high',
        }),
      ),
    )

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    await waitFor(() => {
      expect(within(view.container).getByText('Cohen')).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByText('Cohen'))

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: 'Cohen' })).toBeInTheDocument()
    })
  })

  it('shows busy state and completes mocked matching action', async () => {
    let hasMatched = false
    let releaseMatching: (() => void) | undefined

    const matchingGate = new Promise<void>((resolve) => {
      releaseMatching = resolve
    })

    server.use(
      http.get('http://localhost:8000/api/recommendations/overview', () =>
        HttpResponse.json([
          makeOverviewRow({ family_name: 'Cohen', has_matching: hasMatched }),
        ]),
      ),
      http.post('http://localhost:8000/api/matching/cluster/:profileUuid', async () => {
        await matchingGate
        hasMatched = true
        return HttpResponse.json({
          profile_uuid: '11111111-1111-4111-8111-111111111111',
          recommended_cluster_number: 1,
          cluster_name: 'Cluster A',
          confidence: 'high',
        })
      }),
    )

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    await waitFor(() => {
      expect(within(view.container).getByRole('button', { name: 'הרצת התאמה' })).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'הרצת התאמה' }))

    await waitFor(() => {
      expect(within(view.container).getByRole('button', { name: 'מריץ...' })).toBeDisabled()
    })

    releaseMatching?.()

    await waitFor(() => {
      expect(within(view.container).getByText('הוקצה אשכול')).toBeInTheDocument()
      expect(within(view.container).getByRole('button', { name: 'הרצת התאמה' })).toBeEnabled()
    })
  })

  it('shows action error when mocked matching fails', async () => {
    server.use(
      http.get('http://localhost:8000/api/recommendations/overview', () =>
        HttpResponse.json([makeOverviewRow({ family_name: 'Cohen' })]),
      ),
      matchingFailureHandler('הרצת ההתאמה נכשלה'),
    )

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    await waitFor(() => {
      expect(within(view.container).getByRole('button', { name: 'הרצת התאמה' })).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('button', { name: 'הרצת התאמה' }))

    expect(await within(view.container).findByRole('alert')).toHaveTextContent('הרצת ההתאמה נכשלה')
  })

  it('shows filter-empty state when no rows match active filters', async () => {
    server.use(
      http.get('http://localhost:8000/api/recommendations/overview', () =>
        HttpResponse.json([
          makeOverviewRow({ family_name: 'Cohen', cluster_number: 1, has_matching: true }),
          makeOverviewRow({
            profile_uuid: '22222222-2222-4222-8222-222222222222',
            family_name: 'Levi',
            cluster_number: 2,
            has_matching: true,
          }),
        ]),
      ),
    )

    const view = renderWithProviders(<RecommendationsPanel {...panelProps} />)

    await waitFor(() => {
      expect(within(view.container).getByText('Cohen')).toBeInTheDocument()
    })

    await userEvent.click(within(view.container).getByRole('checkbox', { name: 'ממתין לאשכול' }))

    expect(await within(view.container).findByText('אין משפחות שתואמות למסננים הנוכחיים.')).toBeInTheDocument()
  })
})
