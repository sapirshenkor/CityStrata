import type { FC, ReactNode } from 'react'

export function AuthProvider(props: { children: ReactNode }): JSX.Element

export function useAuth(): {
  user: {
    email: string
    first_name?: string
    last_name?: string
    role?: string
  } | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<unknown>
  signup: (payload: Record<string, unknown>) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}
