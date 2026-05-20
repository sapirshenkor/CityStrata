# Frontend Testing Guide (CityStrata)

This document describes the frontend testing architecture, how to run tests, what is covered today, and how to extend the suite safely.

**Production code:** No production behavior changes were made through Phase 5. All isolation uses MSW, test helpers, and mocked map modules.

**Phase 5 status:** This was the final focused frontend testing wave for now. Heavy GIS orchestration and E2E remain intentionally deferred unless future needs arise.

---

## 1. Frontend testing architecture

The frontend test layer follows a **confidence-over-coverage** model:

| Layer | Purpose | Location |
|-------|---------|----------|
| **Unit** | Pure utilities, Zod schemas, query keys | `src/test/unit/` |
| **Integration-style** | Real providers + MSW + user-visible behavior | `src/test/integration/` |
| **Infrastructure** | MSW handlers, fixtures, render helpers, map mocks | `src/test/setup/`, `src/test/utils/`, `src/test/mocks/` |

**Design principles**

- Meaningful tests over coverage inflation
- MSW at the network boundary (axios/`api.js` stay real)
- Real `QueryClient`, `AuthProvider`, and `MemoryRouter` where valuable
- No shadcn/ui primitive tests unless business logic exists
- No animation/CSS/class assertions
- No map/WebGL/tile rendering tests
- Minimal snapshots
- Backend-aligned fixtures

---

## 2. Testing stack

| Tool | Role |
|------|------|
| **Vitest 2.x** | Test runner (native Vite integration) |
| **happy-dom** | Fast DOM environment |
| **@testing-library/react** | Component/integration rendering |
| **@testing-library/user-event** | Realistic user interactions |
| **@testing-library/jest-dom** | DOM matchers (`toBeInTheDocument`, etc.) |
| **MSW 2.x** | HTTP mocking (`setupServer` in Node) |
| **@vitest/coverage-v8** | Coverage reports (text, HTML, lcov) |

Dev dependencies live in `frontend/package.json`. Production dependencies are unchanged.

---

## 3. Folder structure

```
frontend/
├── vitest.config.ts
├── vitest.setup.ts
├── docs/FRONTEND_TESTING.md
└── src/
    └── test/
        ├── setup/
        │   ├── server.ts
        │   ├── handlers/
        │   │   ├── auth.handlers.ts
        │   │   ├── family.handlers.ts
        │   │   ├── map.handlers.ts
        │   │   ├── recommendations.handlers.ts
        │   │   └── index.ts
        │   └── fixtures/
        │       ├── users.ts
        │       ├── geojson.ts
        │       ├── familyProfiles.ts
        │       └── recommendations.ts
        ├── mocks/
        │   ├── mapMocks.tsx
        │   └── empty.css
        ├── utils/
        │   ├── createTestQueryClient.ts
        │   ├── renderWithProviders.tsx
        │   ├── authHelpers.ts
        │   └── wizardFormHelpers.ts
        ├── unit/
        │   ├── lib/
        │   ├── utils/
        │   ├── hooks/
        │   └── schemas/
        └── integration/
            ├── auth/
            ├── components/
            ├── family/
            ├── map/
            ├── recommendations/
            └── dashboard/
```

Test files may also live under `src/**/*.test.{ts,tsx,js,jsx}` per Vitest config, but new tests should prefer `src/test/` for shared infrastructure.

---

## 4. Provider strategy

### QueryClient

`createTestQueryClient()` creates a fresh client per test:

- `retry: false`
- `gcTime: 0`
- `staleTime: 0`

This prevents cache bleed and retry flakiness.

### AuthProvider

Integration tests use the **real** `AuthProvider` from `src/context/AuthContext.jsx`.

- Session bootstrap calls `/api/auth/me` via MSW
- Token persistence uses real `localStorage` + axios interceptors
- Do **not** mock `useAuth()` in integration tests

### Router

`renderWithProviders()` wraps UI in `MemoryRouter` with a configurable `route`.

- Use route-level fixtures instead of mounting full `App.jsx`
- Assert redirects with role/heading queries scoped to the render container

---

## 5. MSW strategy

### Default handlers

Registered in `src/test/setup/handlers/` and started in `vitest.setup.ts`:

| Domain | Endpoints |
|--------|-----------|
| Auth | `/api/auth/me`, `/login`, `/signup`, `/logout` |
| Map/dashboard reads | `/api/statistical-areas`, summaries, hotels, airbnb, matnasim, osm-facilities, clustering |
| Recommendations | `/api/recommendations/overview`, matching result, tactical run, community run |
| Family portal | `/api/family/me/profiles` (GET/POST/PATCH), profile by UUID |

Default `/api/auth/me` returns **401** (guest session).

### Scenario handlers

Override per test with `server.use(...)`:

```typescript
import { server } from '@/test/setup/server'
import { meHandlerAs } from '@/test/setup/handlers/auth.handlers'
import { makeAuthUser } from '@/test/setup/fixtures/users'

server.use(meHandlerAs(makeAuthUser({ role: 'editor' })))
```

### External API prevention

- `server.listen({ onUnhandledRequest: 'error' })` — any unhandled HTTP call fails the test
- No real backend process required
- Agent endpoints (`matching`, `tactical`) return immediate deterministic MSW responses; use deferred handlers only when asserting in-flight busy UI

### Fixture alignment

Fixtures in `src/test/setup/fixtures/` mirror backend shapes from `backend/tests/helpers/factories.py` and `backend/tests/api/test_recommendations.py`:

- `makeAuthUser()` ↔ municipality user + login response
- `makeStatisticalAreasCollection()` ↔ GeoJSON FeatureCollection
- `makeStatisticalAreaSummary()` ↔ area summary API
- `makeFamilyProfileCreatePayload()` / `makeFamilyProfileResponse()` ↔ backend `evacuee_profile_db_row`
- `makeOverviewFixture()` / `makeOverviewRow()` ↔ recommendation overview rows

---

## 5a. Integration testing strategy

Integration-style tests mount **real screens** with **real providers** and **MSW** at the HTTP boundary:

1. Define a minimal `Routes` fixture (destination routes only — never full `App.jsx` unless unavoidable)
2. Use `renderWithProviders()` with `MemoryRouter`
3. Seed auth when needed: `seedAuthToken()` + `meHandlerAs(user)`
4. Interact via `userEvent` + accessible queries (`getByRole`, `getByLabelText`, `role="alert"`)
5. Assert user-visible outcomes: headings, alerts, navigation, token persistence
6. Scope queries with `within(view.container)` to avoid cross-test DOM bleed

**Do not** mock `useAuth`, `useQuery`, or axios internals in these tests.

---

## 5b. Auth flow testing strategy

Auth integration tests exercise the full client path:

```
Form submit → AuthContext.login/signup → authApi → MSW → token in localStorage → redirect
```

| Scenario | MSW approach |
|----------|--------------|
| Successful login | Default `auth.handlers.ts` login handler |
| Invalid credentials | Password `wrong-password` → 401 |
| Network failure | `HttpResponse.error()` on login |
| Signup + auto-login | Signup 201 → login 200 (AuthContext calls both) |
| API validation | `server.use()` returning FastAPI `detail` array (422) |
| Protected redirect | `location.state.from.pathname` via `MemoryRouter` initial entry |
| Token persistence | Assert `getStoredAuthToken()` after successful login |

Pages tested: `LoginPage`, `SignupPage`, plus guards from Phase 3 (`ProtectedRoute`, `UserBar`).

---

## 5c. FamilyEvacueeWizard testing strategy

Wizard tests focus on **validation and submission only** — not recommendations, maps, or tactical flows.

| Concern | Approach |
|---------|----------|
| Auth | Visitor session via `meHandlerAs(makeVisitorUser())` + token |
| Routing | Minimal routes: `/family/profile/new` → wizard, `/family` → destination heading |
| Step validation | Click `הבא` with empty step 1 → Hebrew `שדה חובה` errors, stay on step 1 |
| Step progression | `fillStep1Contact()` helper → advance to step 2 |
| Full submit | Fill step 1, advance through defaults on steps 2–7, click `שליחה` |
| Payload correctness | `createFamilyProfileCapture()` records POST body |
| Submit failure | MSW 422 with `{ detail: '...' }` |
| Back navigation | Step 2 → `חזור` → step 1 |

Legacy step inputs use plain `<label>` without `htmlFor`; `wizardFormHelpers.ts` fills fields by stable DOM order rather than adding production `data-testid`s.

Map libraries are not imported by the wizard — no map mock required for these tests.

---

## 5d. Operational UI testing strategy (Phase 5)

Phase 5 strengthened confidence around **operational UI behavior** and **async recommendation surfaces** without map orchestration or full-app E2E complexity.

| Principle | Implementation |
|-----------|----------------|
| Scope control | Test orchestration, role visibility, filters, busy states — not GIS rendering |
| Map isolation | Mock heavy children (`MapView`, wizard forms, nested panels) at module boundary |
| Error surfaces | Assert `role="alert"` and Hebrew copy in real screen context |
| Agent actions | MSW POST handlers return immediately; deferred gate only for busy-state assertions |
| Performance | Avoid full `App.jsx` mounts; bounded integration files (~5–8 cases each) |

**Intentionally out of scope:** MapApp orchestration, tile loading, coordinate assertions, Playwright, visual regression.

---

## 5e. MapSidebar testing strategy

`MapSidebar.test.tsx` mocks nested forms/panels and tests **role-based tab visibility** only:

| Role | Expected behavior |
|------|-------------------|
| Guest | Public listings panel; no operational tabs |
| Visitor | Family + family-recommendations tabs only |
| Editor/admin | All five operational tabs |
| All roles | Tab switching shows mocked panel content; agent overlay does not break structure |

Auth: `seedAuthToken()` + `meHandlerAs(makeVisitorUser() | makeAuthUser({ role: 'editor' }))`.

No map library imports — sidebar orchestration only.

---

## 5f. RecommendationsPanel testing strategy

`RecommendationsPanel.test.tsx` exercises overview query lifecycle and operational interactions:

| Scenario | MSW / assertion approach |
|----------|--------------------------|
| Loading | `overviewLoadingHandler()` → skeleton + `טוען משפחות...` |
| Empty | `overviewEmptyHandler()` → `אין עדיין משפחות` |
| API failure | `overviewErrorHandler()` → Hebrew heading + axios status message |
| Cluster filter | Per-test overview override; select `אשכול` option |
| Row selection | Click family name → detail heading |
| Matching busy/success | Deferred POST gate → `מריץ...` disabled → `הוקצה אשכול` pill |
| Matching failure | `matchingFailureHandler()` → action alert |
| Filter empty | All rows `has_matching: true` + `ממתין לאשכול` checkbox |

Tactical/community full orchestration and map focus callbacks are not tested here.

---

## 5g. DashboardContainer and ApiErrorBanner strategy

`DashboardContainer.test.tsx` mocks `MapView` (no Leaflet) and tests dashboard query wiring:

| Scenario | Surface |
|----------|---------|
| KPI render | Single-area MSW fixture → predictable `institutions_count` value |
| Metrics failure | Hotels 500 → `ApiErrorBanner` with Hebrew message + `נסו שוב` |
| Retry | Second hotels response succeeds → refetch invoked |
| Areas failure | Statistical areas 500 → error passed to mocked `MapView` alert |
| Empty areas | Empty FeatureCollection → insights empty messaging |

`ApiErrorBanner` is also exercised indirectly via formatted query errors (`formatQueryError`) in dashboard metrics path. Recommendation overview errors use the panel's own `rec-state--error` alert (same user-facing pattern, different component).

---

## 6. Map mocking strategy

Map libraries are **never** rendered in default unit/integration tests.

### Mapbox (`react-map-gl/mapbox`)

Use the test double from `src/test/mocks/mapMocks.tsx`:

```typescript
vi.mock('react-map-gl/mapbox', () => import('@/test/mocks/mapMocks').then(m => m.mapboxGlTestDouble))
```

### Leaflet (`react-leaflet`)

Use `leafletTestDouble` from the same file for dashboard map tests in future phases.

### CSS imports

`vitest.config.ts` aliases map CSS to `src/test/mocks/empty.css`.

### Test vs intentionally not tested

| Test | Do not test |
|------|-------------|
| Layer visibility state in orchestrators | Tile loading |
| Sidebar/panel interactions | Canvas/WebGL output |
| Props passed into mocked map abstractions | Coordinate DOM assertions |
| Pure geo helpers (`recommendationZones.js`) | Mapbox token-dependent rendering |

---

## 7. Test categories

| Category | Examples in repo | When to use |
|----------|------------------|-------------|
| **Unit** | `formatApiError`, Zod schemas, `recommendationZones` | Pure logic, fast, deterministic |
| **Component / integration-style** | `ProtectedRoute`, `UserBar`, `MapSidebar`, `RecommendationsPanel` | Auth, routing, role UI, operational panels |
| **Integration (flows)** | Auth pages, family wizard, dashboard | Multi-step / multi-query flows with MSW |
| **E2E (Playwright)** | — | Intentionally deferred; not in scope |

---

## 8. Commands

From `frontend/`:

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Coverage (text + HTML + lcov)
npm run test:coverage

# Specific integration suites
npx vitest run src/test/integration/auth/LoginPage.test.tsx
npx vitest run src/test/integration/auth/SignupPage.test.tsx
npx vitest run src/test/integration/family/FamilyEvacueeWizard.test.tsx
npx vitest run src/test/integration/auth/ProtectedRoute.test.tsx
npx vitest run src/test/integration/map/MapSidebar.test.tsx
npx vitest run src/test/integration/recommendations/RecommendationsPanel.test.tsx
npx vitest run src/test/integration/dashboard/DashboardContainer.test.tsx

# Production build verification
npm run build
```

---

## 9. Current test count

**87 tests** across **16 test files** (as of Phase 5 — final focused wave).

| File | Tests |
|------|-------|
| `unit/utils/recommendationZones.test.js` | 16 |
| `unit/schemas/evacueeFamilyProfileSchemas.test.js` | 7 |
| `integration/recommendations/RecommendationsPanel.test.tsx` | 8 |
| `integration/auth/LoginPage.test.tsx` | 6 |
| `unit/schemas/authFormSchemas.test.ts` | 6 |
| `integration/map/MapSidebar.test.tsx` | 5 |
| `integration/family/FamilyEvacueeWizard.test.tsx` | 5 |
| `integration/dashboard/DashboardContainer.test.tsx` | 5 |
| `unit/schemas/hotelFormSchema.test.ts` | 4 |
| `integration/auth/SignupPage.test.tsx` | 4 |
| `integration/auth/ProtectedRoute.test.tsx` | 4 |
| `integration/components/UserBar.test.tsx` | 4 |
| `unit/lib/formatQueryError.test.ts` | 4 |
| `unit/schemas/poiFormSchema.test.ts` | 3 |
| `unit/lib/formatApiError.test.ts` | 3 |
| `unit/hooks/mapQueryKeys.test.ts` | 3 |

**Split:** 46 unit · 41 integration-style

**Phase 5 delta:** +18 tests (+3 files) — MapSidebar (5), RecommendationsPanel (8), DashboardContainer (5)

---

## 10. Current coverage percentage

From `npm run test:coverage` (Phase 5):

| Metric | Coverage | Phase 4 | Change |
|--------|----------|---------|--------|
| **Statements / Lines** | **25.01%** | 13.07% | **+11.94 pp** |
| **Branches** | **70.57%** | 68.55% | +2.02 pp |
| **Functions** | **43.76%** | 35.71% | +8.05 pp |

Low overall line coverage remains **expected** — the app is large and tests target high-value flows, not full UI breadth.

---

## 11. Coverage breakdown (notable files)

| File / area | Coverage | Notes |
|-------------|----------|-------|
| `lib/authFormSchemas.ts` | 100% | Login/signup validation |
| `lib/formatQueryError.ts` | 100% | Query error formatting |
| `hotels_management/hotelFormSchema.ts` | 100% | Hotel form validation |
| `pages/LoginPage.tsx` | Exercised | Full login flow integration |
| `pages/SignupPage.tsx` | Exercised | Signup + auto-login integration |
| `family_portal/FamilyEvacueeWizard.tsx` | Exercised | Wizard validation + submit |
| `components/Recommendations/RecommendationsPanel.jsx` | Exercised | Overview, filters, matching busy/error |
| `components/Sidebar/MapSidebar.tsx` | Exercised | Role-based tab visibility |
| `user_dashboard/DashboardContainer.tsx` | Exercised | KPIs, ApiErrorBanner, areas error/empty |
| `user_dashboard/hooks/useDashboardQueries.ts` | Exercised | Metrics aggregation + venue counts |
| `hooks/useRecommendationsData.ts` | Exercised | Overview query lifecycle |
| `components/layout/ApiErrorBanner.tsx` | Exercised | Dashboard metrics failure + retry |
| `services/authApi.js` | ~71%+ | Login/signup/logout paths hit |
| `utils/recommendationZones.js` | ~82% | Geo/recommendation helpers |
| `context/AuthContext.jsx` | ~87%+ | Login, signup, logout, bootstrap |
| `poi_management/poiFormSchema.ts` | ~73% | POI category schemas (partial categories) |
| `hooks/mapQueryKeys.ts` | ~76% | Query key stability |
| `components/ProtectedRoute.jsx` | Covered via integration | Phase 3 |
| `components/UserBar.tsx` | Covered via integration | Phase 3 |
| `lib/formatApiError.ts` | ~48%+ | Extended via login/signup error paths |
| `components/ui/**` | Excluded | shadcn primitives intentionally excluded |

HTML report: `frontend/coverage/index.html`

---

## 12. Phase 2 infrastructure (completed)

- Vitest + happy-dom + Testing Library + MSW + coverage tooling
- `vitest.config.ts`, `vitest.setup.ts`
- MSW server and default auth/map handlers
- Contract-aligned fixtures (`users.ts`, `geojson.ts`)
- `renderWithProviders`, `createTestQueryClient`, `authHelpers`
- Mapbox/Leaflet test doubles
- Smoke test: `formatApiError.test.ts` (3 tests)

---

## 13. Phase 3 additions

### Unit tests

- `recommendationZones.test.js` — Hebrew hub labels, LLM section parsing, zone ordering, point-in-zone logic, bounds helpers, lodging coordinate collection
- `formatQueryError.test.ts` — FastAPI detail, validation arrays, Error fallback
- `mapQueryKeys.test.ts` — stable cache keys
- `authFormSchemas.test.ts` — login/signup validation + signup payload mapping
- `evacueeFamilyProfileSchemas.test.js` — full profile validation, step schemas, `toPayload`, `formatZodErrors`
- `hotelFormSchema.test.ts` — required fields, URL/rating validation, payload mapping
- `poiFormSchema.test.ts` — education, coffee shop JSON hours, synagogue bilingual name/type rules

### Integration-style tests

- `ProtectedRoute.test.tsx` — loading, unauthenticated redirect + `from` state, allowed role, wrong-role redirect
- `UserBar.test.tsx` — guest, visitor, editor links, logout clears session

### Infrastructure fix

- Added `@testing-library/react` `cleanup()` in `vitest.setup.ts` for deterministic test isolation

---

## 14. Phase 4 additions

### MSW and fixtures

- `family.handlers.ts` — family profile GET/POST/PATCH handlers
- `familyProfiles.ts` — payloads aligned with `backend/tests/helpers/factories.py`
- `createFamilyProfileCapture()` — records POST body for payload assertions

### Test utilities

- `wizardFormHelpers.ts` — step 1 fill + multi-step advance helpers

### Auth page integration tests

- `LoginPage.test.tsx` (6) — success + token + redirect, `state.from` redirect, client validation, invalid credentials, network error, submitting state
- `SignupPage.test.tsx` (4) — signup + auto-login + redirect, validation errors, FastAPI 422 detail, submitting state

### Family wizard integration tests

- `FamilyEvacueeWizard.test.tsx` (5) — step 1 validation block, step 1→2 progression, successful create + navigation, submit error, back navigation

---

## 15. Phase 5 additions (final focused wave)

### MSW and fixtures

- `recommendations.handlers.ts` — overview, matching, tactical, community endpoints + scenario helpers (`overviewLoadingHandler`, `overviewErrorHandler`, `overviewEmptyHandler`, `matchingFailureHandler`)
- `recommendations.ts` — overview rows aligned with `backend/tests/api/test_recommendations.py`
- `map.handlers.ts` — extended with airbnb/property-listings venue endpoints

### MapSidebar integration tests

- `MapSidebar.test.tsx` (5) — guest public listings, visitor tab set, editor all tabs, tab switching, agent overlay coexistence
- Heavy children mocked: `EvacueeProfileForm`, `CommunityForm`, `RecommendationsPanel`, `CommunityProfilesPanel`

### RecommendationsPanel integration tests

- `RecommendationsPanel.test.tsx` (8) — loading, empty, overview API error, cluster filter, row selection, matching busy/success (deferred POST gate), matching failure, filter-empty state

### DashboardContainer integration tests

- `DashboardContainer.test.tsx` (5) — KPI render (single-area fixture), `ApiErrorBanner` on metrics failure + retry, map areas error via mocked `MapView`, empty statistical areas messaging
- `MapView` mocked — no Leaflet rendering

### Testing pause

After Phase 5, the frontend testing effort **pauses** unless new product needs arise. Remaining gaps (MapApp, E2E, hotels/POI pages) are documented below as intentionally deferred.

---

## 16. Known gaps (intentional)

| Area | Status |
|------|--------|
| `FamilyEvacueeWizard` edit mode | Not yet tested (create flow covered) |
| `MapApp` orchestration | Intentionally deferred (Mapbox mocked when added) |
| Full dashboard map rendering | `MapView` mocked; spatial interaction not tested |
| `RecommendationsPanel` tactical/community full flows | Partial — overview/matching covered; tactical detail + community merge not fully orchestrated |
| Hotels/POI management pages | Deferred |
| Map layer components | Intentionally deferred |
| E2E (Playwright) | Future optional layer |
| Full `App.jsx` smoke | Not required |
| Sidebar `FormWizard.jsx` duplicate | Test after patterns stabilize |
| Visual regression | Out of scope |
| CI GitHub Actions job | Example documented; not yet committed |

**Phase 5 completed:** `RecommendationsPanel` (controlled), `DashboardContainer` (lightweight), `MapSidebar` role tabs, `ApiErrorBanner` in dashboard context.

---

## 17. Recommended stopping point and optional future phases

### Stopping point (current)

The suite now covers auth, family wizard create flow, role guards, operational sidebar tabs, recommendation overview/actions, and dashboard KPI/error states. This meets the Phase 5 goal: **controlled, maintainable, fast** confidence without heavy GIS or E2E.

**Pause frontend testing here** unless new features or regressions require expansion.

### Optional future phases (only if needed)

| Phase | Scope | When to consider |
|-------|-------|------------------|
| Map orchestration | `MapApp`, `MapLayersPanel`, lodging scope (Mapbox mocked) | Map regressions or role-layer bugs |
| Management pages | Hotels/POI CRUD integration | Editor workflow changes |
| CI gate | GitHub Actions `npm ci && npm run test && npm run build` | PR merge policy |
| E2E | Playwright smoke against deployed stack | Pre-release validation |

Heavy GIS rendering, tile loading, coordinate assertions, and visual regression remain **out of scope** by design.

---

## 18. CI/CD readiness notes

The suite is designed for GitHub Actions:

```yaml
# Example job (not yet committed)
- working-directory: frontend
  run: |
    npm ci
    npm run test
    npm run build
```

Coverage artifact:

```yaml
- run: npm run test:coverage
  working-directory: frontend
- uses: actions/upload-artifact@v4
  with:
    name: frontend-coverage
    path: frontend/coverage/
```

**Properties suitable for CI**

- No backend dependency
- No Mapbox token required
- Deterministic MSW responses
- Fork pool (`pool: 'forks'`) for Windows/Linux compatibility
- Fast default run (~15–20s for 87 tests on dev hardware; unit-only ~3s)

---

## 19. Debugging tips

### Unhandled MSW request

Error: `[MSW] Cannot bypass a request...`

1. Identify the URL from the error
2. Add a handler in `src/test/setup/handlers/`
3. Or override in-test with `server.use(...)`

### Auth state surprises

1. Check `localStorage` key `citystrata_access_token`
2. Verify `/api/auth/me` handler for the test scenario
3. Use `seedAuthToken()` + `meHandlerAs(user)` together

### Duplicate elements in queries

1. Ensure tests use `within(view.container)` from `renderWithProviders()`
2. `cleanup()` runs in `afterEach` — do not disable it

### React Query async

Use `waitFor` on **user-visible outcomes** (headings, alerts, links), not cache internals.

### Map import errors in future tests

Register map mocks **before** importing components that pull in `react-map-gl` or `react-leaflet`.

---

## 20. Production behavior confirmation

**No production frontend files were modified in Phase 5.**

Changes were limited to:

- `frontend/src/test/**` (new tests, handlers, fixtures)
- `frontend/docs/FRONTEND_TESTING.md` (this document)

`npm run build` passes unchanged.

---

## Quick reference: adding a new integration test

```typescript
import { describe, it, expect } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import { server } from '@/test/setup/server'
import { meHandlerAs, TEST_ACCESS_TOKEN } from '@/test/setup/handlers/auth.handlers'
import { makeAuthUser } from '@/test/setup/fixtures/users'
import { seedAuthToken } from '@/test/utils/authHelpers'
import { renderWithProviders } from '@/test/utils/renderWithProviders'

describe('MyFeature', () => {
  it('shows role-appropriate content', async () => {
    server.use(meHandlerAs(makeAuthUser({ role: 'editor' })))
    seedAuthToken(TEST_ACCESS_TOKEN)

    const view = renderWithProviders(<MyScreen />, { route: '/my-route' })

    await waitFor(() => {
      expect(within(view.container).getByRole('heading', { name: /.../ })).toBeInTheDocument()
    })
  })
})
```

Prefer `getByRole`, `getByLabelText`, and `role="alert"` over `data-testid`.
