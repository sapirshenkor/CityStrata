/**
 * Contract-aligned auth user shapes.
 * Mirrors backend/tests/helpers/factories.py municipality_user + /api/auth/* responses.
 */

export type AuthUserRole = 'visitor' | 'editor' | 'admin'

export interface AuthUserFixture {
  id?: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone_number?: string | null
  semel_yish?: number
  department?: string | null
  role: AuthUserRole
  is_active?: boolean
}

export const TEST_ACCESS_TOKEN = 'test-access-token'

export function makeAuthUser(overrides: Partial<AuthUserFixture> = {}): AuthUserFixture {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'editor@example.com',
    first_name: 'Test',
    last_name: 'Editor',
    phone_number: '0500000000',
    semel_yish: 2600,
    department: 'QA',
    role: 'editor',
    is_active: true,
    ...overrides,
  }
}

export function makeVisitorUser(overrides: Partial<AuthUserFixture> = {}): AuthUserFixture {
  return makeAuthUser({
    email: 'visitor@example.com',
    first_name: 'Family',
    last_name: 'User',
    department: null,
    role: 'visitor',
    ...overrides,
  })
}

export function makeLoginResponse(user: AuthUserFixture = makeAuthUser()) {
  return {
    access_token: TEST_ACCESS_TOKEN,
    user,
  }
}
