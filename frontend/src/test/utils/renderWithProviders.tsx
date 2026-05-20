import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { createTestQueryClient } from './createTestQueryClient'

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  routerProps?: Omit<MemoryRouterProps, 'children'>
  queryClient?: QueryClient
  withAuth?: boolean
}

/**
 * Integration-style render helper: real QueryClient, router, and AuthProvider.
 * Network calls are intercepted by MSW — do not mock useAuth/useQuery here.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    routerProps,
    queryClient = createTestQueryClient(),
    withAuth = true,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const routed = (
      <MemoryRouter initialEntries={[route]} {...routerProps}>
        {children}
      </MemoryRouter>
    )

    const withProviders = withAuth ? <AuthProvider>{routed}</AuthProvider> : routed

    return <QueryClientProvider client={queryClient}>{withProviders}</QueryClientProvider>
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}
