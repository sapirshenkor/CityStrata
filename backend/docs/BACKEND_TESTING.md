# Backend Testing Guide (CityStrata)

This document describes how to run backend tests, how the testing architecture is organized, and what is covered today.

**Production code:** No changes to `app/` behavior were made for testing. All isolation uses mocks, dependency overrides, and test-only helpers.

## Stack

| Tool | Role |
|------|------|
| **pytest** | Test runner |
| **pytest-asyncio** | Async tests and fixtures (`asyncio_mode = auto`) |
| **httpx** + `ASGITransport` | HTTP-level API tests against FastAPI (no live server) |
| **pytest-cov** | Coverage (terminal + HTML) |
| **unittest.mock / pytest monkeypatch** | Supabase, OpenAI, tactical pipeline, DB pool |
| **respx** | Mock Nominatim HTTP in unit tests |

Production dependencies remain in `requirements.txt`. Test tools are in `requirements-dev.txt`.

## Folder structure

```
backend/
├── pytest.ini
├── .coveragerc
├── requirements-dev.txt
├── docs/BACKEND_TESTING.md
└── tests/
    ├── conftest.py
    ├── helpers/
    │   ├── mock_db.py          # MockPool (+ transaction() for listings)
    │   ├── factories.py        # users, profiles, listings, tactical rows
    │   └── matching_data.py    # cluster rows, Agent1Response samples
    ├── unit/
    ├── api/
    ├── slow/
    └── integration/
```

## Testing architecture

### Fixture strategy

| Fixture | Scope | Purpose |
|---------|-------|---------|
| `mock_pool` | function | Fresh `MockPool` with configurable query handlers |
| `install_mock_db` | async function | Sets `database._pool`; patches lifespan init/close |
| `app` | async function | `create_app()` with mock DB wired |
| `client` | async function | `httpx.AsyncClient` with `ASGITransport` |
| `auth_overrides` | function | Callable to override `get_current_user` only |
| `authed_client` | function | Client with editor user override applied |

Environment variables are set at the top of `tests/conftest.py` **before** importing `app`.

### Mock strategy

| Dependency | How tests isolate it |
|------------|----------------------|
| **PostgreSQL** | `MockPool` / `MockConnection` — handlers match SQL substrings; no TCP |
| **Supabase** | Patch `app.api.endpoints.auth.get_supabase_anon` (module import path) |
| **OpenAI / matching agent** | Patch `app.api.endpoints.matching.match_family_to_cluster` (and community variant when needed) |
| **MCP / tactical pipeline** | Patch `app.api.endpoints.recommendations.execute_tactical_pipeline` and `execute_community_tactical_pipeline` |
| **Nominatim (service)** | **respx** mocks `https://nominatim.openstreetmap.org/search` in unit tests |
| **Nominatim (property listings)** | Not exercised in API tests (uses geopy); documented gap |

**Determinism:** No random data, no live network, no timing-based assertions in default tests.

### Dependency override strategy

- `auth_overrides(role=...)` sets `get_current_user` only.
- `require_editor` is **not** overridden so 403 role checks remain real.
- Cleared after each test in fixture teardown.

### Database isolation approach

| Mode | When | How |
|------|------|-----|
| **Default** | `pytest` | Mock pool only |
| **Integration** | `pytest -m integration` | Placeholder (skipped); never production DB |

### Async testing approach

- `pytest-asyncio` with `asyncio_mode = auto`
- API tests: `async def` + `await client...`
- `MockConnection.transaction()` supports property-listing write paths

### Coverage strategy

- Scope: `app/` only (`backend/.coveragerc`)
- Quality over percentage — assert business rules, status codes, and response shapes
- Do not add trivial tests to inflate coverage

### CI/CD readiness

Default suite is fast (~8s) and network-free. Suggested CI:

```powershell
pip install -r requirements.txt -r requirements-dev.txt
cd backend
python -m pytest --cov=app --cov-report=xml
```

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
```

On Windows, if `python` fails after install, use:

`C:\Users\<you>\AppData\Local\Python\pythoncore-3.14-64\python.exe -m pytest`

## Commands

```powershell
cd backend

# All default tests (76 tests; excludes slow/integration)
python -m pytest

# Verbose
python -m pytest -v

# Focused groups (phase 2)
python -m pytest tests/api/test_matching.py -v
python -m pytest tests/api/test_recommendations.py -v
python -m pytest tests/api/test_family.py -v
python -m pytest tests/api/test_property_listings.py -v
python -m pytest tests/api/test_error_handling.py -v
python -m pytest tests/unit/test_nominatim_geocoding.py -v

# Coverage (terminal + HTML)
python -m pytest --cov=app --cov-report=term-missing --cov-report=html
start htmlcov\index.html

# Include slow ML tests
python -m pytest -m ""

# Slow only
python -m pytest -m slow
```

## Environment variables

Tests set safe defaults in `conftest.py` (see `.env.test.example` at repo root for documentation).

## Test inventory

### Phase 1 (foundation) — 38 tests

- Unit: geojson, spatial, POI registry, matching formatters, auth dependencies, community validation
- API: OpenAPI, nearby validation, evacuation, statistical areas, auth routes, POI permissions, clustering reads

### Phase 2 (business flows) — +38 tests (76 default total)

| File | What it verifies |
|------|------------------|
| `tests/api/test_matching.py` | POST `/matching/cluster*` with mocked agent; 404/422/500; GET `/matching/result/{uuid}` |
| `tests/api/test_recommendations.py` | POST `/recommendations/run/*` and `/community/run` with mocked pipeline; overview visitor scoping; 400/404/504/500 |
| `tests/api/test_family.py` | `/family/me` auth, user_id scoping, dashboard counts, create assigns `user_id` |
| `tests/api/test_property_listings.py` | `/mine` auth; PATCH/DELETE 403 for non-owner; geo filter 400; validation 422; **documents GET-by-id read gap** |
| `tests/api/test_error_handling.py` | DB exceptions → 500; missing tactical row after mocked pipeline |
| `tests/unit/test_nominatim_geocoding.py` | respx: success, empty query, no results, HTTP 503 |

**Opt-in (not in default count):** 2 slow ML tests, 1 skipped integration placeholder.

## Current coverage

**Last verified:** **76 passed**, **3 deselected** (slow/integration), **53.7%** line coverage on `app/`.

| Metric | Phase 1 | Phase 2 | Change |
|--------|---------|---------|--------|
| Default tests | 38 | 76 | +38 |
| `app/` coverage | 45.4% | 53.7% | **+8.3 pp** |

### Coverage by area

| Area | Coverage | Notes |
|------|----------|-------|
| **matching routes** | 67.2% | `matching.py` — POST + GET result paths |
| **recommendations** | 71.7% | `recommendations.py` — run + overview; pipeline body mocked |
| **family portal** | 56.3% | `family.py` — list/get/dashboard/create |
| **property listings** | 40.2% | auth/ownership on write; public list partial |
| **auth core** | 82.6% | `auth.py` |
| **evacuation** | 86.7% | unchanged |
| **Nominatim service** | 97.6% | `nominatim_geocoding.py` via respx |
| **tactical_pipeline** | 26.5% | module not executed (mocked at endpoint) |
| **matchingAgent** | 62.3% | formatters + imports; OpenAI path not called |
| **GIS layer endpoints** | ~20–62% | statistical_areas 62%; others still low |
| **mcp/** | Excluded | mock at API boundary |

## Known gaps and documented security notes

### Security / authorization (current behavior — not “fixed” in tests)

| Issue | Behavior | Test reference |
|-------|----------|----------------|
| **Property listing GET by ID** | Any authenticated user can read any listing; `current` is ignored on read | `test_get_listing_by_id_allows_any_authenticated_user` |
| **Property units table** | `/units-table` returns all units globally for any authenticated user | not yet tested |
| **Evacuee profiles (municipal)** | `/evacuee-family-profiles` list/get are public (no auth) | documented in phase 1 |

### Testing gaps (recommended phase 3)

- `POST /matching/cluster/community/{id}` success path
- `POST /recommendations/community/run` success with mocked pipeline + DB row
- Property listing **create** with mocked transaction (no geopy)
- Hotels management CRUD with `require_editor`
- `auth` signup flow (mock Supabase service role)
- Multi-family profile resolution paths in matching/recommendations GET
- Isolated Postgres integration suite (`integration` marker)

## Production code policy

Tests use **monkeypatch, dependency overrides, and mocks only**. No production refactors for testability unless unavoidable and approved.

**Confirmed:** Phase 1 and Phase 2 did not modify `backend/app/` production modules.
