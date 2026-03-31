# CityStrata Tactical MCP Server

Python [Model Context Protocol](https://modelcontextprotocol.io/) server exposing **PostGIS + pgvector** tools for an evacuee relocation agent: family/cluster context, semantic nearby search, and location scoring.

## Prerequisites

- Python **3.10+**
- PostgreSQL with **PostGIS** and **pgvector** (same DB as CityStrata)
- OpenAI API key (embeddings: `text-embedding-3-small`)

## Install

```bash
pip install -r backend/mcp/requirements.txt
```

## Configure `.env`

The server searches for `.env` in this order: `backend/mcp/.env` → `backend/.env` → project root `.env` → current working directory.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | AsyncPG-compatible Postgres URL (e.g. Supabase pooler or direct) |
| `OPENAI_API_KEY` | OpenAI API key for embedding calls |

## Run

**Server only (stdio):**
```bash
python backend/mcp/mcp_server.py
```

**Full end-to-end pipeline:**
```bash
python backend/mcp/tactical_agent.py --family-id YOUR_PROFILE_UUID --radius-km 2.5
# or
set TACTICAL_SAMPLE_FAMILY_ID=<uuid> && python backend/mcp/tactical_agent.py
```

The agent runs four steps: context → discovery → parallel scoring → Markdown report printed to stdout.

## Tools

| Tool | Purpose |
|------|---------|
| `get_family_tactical_context` | Load family profile + macro cluster center (mean of statistical area centroids). |
| `search_nearby_amenities` | Embed `query_text`, spatial pre-filter with `ST_DWithin`, cosine rank via pgvector → top 5. |
| `calculate_location_score` | Score a listing 0–10 using education, synagogue, matnas proximity + cluster distance penalty. |

**Whitelisted tables:** `airbnb_listings`, `hotels_listings`, `synagogues`, `educational_institutions`, `matnasim`, `coffee_shops`, `restaurants`, `osm_city_facilities`

## Scoring model

Base score **5.0**, clamped to **[0, 10]**.

| Component | Condition | Δ score |
|-----------|-----------|---------|
| Education (tag match) | Matches within radius | up to +3.0 |
| Education (no tag match) | Schools present, no tag match | up to +1.5 |
| Education | No schools in radius | −1.0 |
| Synagogue | ≤ 200 m | +1.80 |
| Synagogue | 200 m – 800 m | +1.00 |
| Synagogue | 800 m – 3 km | +0.30 |
| Synagogue | > 3 km | −0.80 |
| Matnas | ≤ 500 m | +1.50 |
| Matnas | 500 m – 1.5 km | +0.70 |
| Matnas | > 1.5 km | −0.40 |
| Cluster penalty | 0.5 pts × km beyond 1.5 km | − varies |

Rankings sort by **score DESC**, then **distance to cluster centre ASC** as tiebreaker.

## Troubleshooting

**Debug log** — the server writes trace lines to a temp file (no stderr pipe needed):
```powershell
Get-Content "$env:TEMP\citystrata_mcp_debug.log" -Wait
```
The last line before a hang identifies the stall point:

| Last log line | Cause |
|---------------|-------|
| `calling OpenAI embed…` | OpenAI unreachable from child process |
| `calling _get_pool()…` | DB connection failing (check `DATABASE_URL`, VPN) |
| `connection acquired, running SQL phase 1…` | Spatial query slow — verify GiST index on `location` |
| `SQL phase 1 done — 0 candidates` | Wrong cluster centre or radius too small |
| `running SQL phase 2…` | Vector rank slow — verify HNSW index on `embedding` |

**Common issues:**

- **Windows OpenAI stall in MCP child** — embeddings use stdlib `urllib` on a thread executor, not `httpx`. This avoids the ProactorEventLoop/piped-stdout hang. Do not reintroduce the `openai` SDK in `mcp_server.py`.
- **`statement_timeout` not firing** — the pool sets it via `server_settings` at startup, which survives PgBouncer transaction mode. `SET LOCAL` inside a transaction is unreliable with PgBouncer and is not used.
- **Missing GiST / HNSW indexes** — run `backend/sql/0018_*` and `backend/sql/0019_*` in Supabase, then `ANALYZE` the listing tables.
- **`ModuleNotFoundError: mcp`** — run `pip install -r backend/mcp/requirements.txt` in the same environment as the `command` Python.
- **`--forward-server-stderr` hangs on Windows** — this flag pipes the child's stderr; if nothing drains it the process can deadlock. Use the debug log file instead. Only enable `--forward-server-stderr` when actively debugging.