# CityStrata Tactical MCP Server

Python [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes **PostGIS + pgvector** tools for a relocation agent: family/cluster context, semantic nearby search, and listing suitability scoring.

## Prerequisites

- Python **3.10+**
- PostgreSQL with **PostGIS** and **pgvector** (same DB as CityStrata)
- OpenAI API key (embeddings: `text-embedding-3-small`)

## Install

From the project root (or any venv you use for tooling):

```bash
pip install -r mcp/requirements.txt
```

## Configure `.env`

The server loads `.env` from (first match wins):

1. `mcp/.env`
2. Project root `.env` (parent of the `mcp/` folder)
3. Current working directory `.env`

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | AsyncPG-compatible Postgres URL (e.g. Supabase pooler or direct). |
| `OPENAI_API_KEY` | OpenAI API key for embedding calls. |

Example `.env`:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
OPENAI_API_KEY=sk-...
```

## Run locally (stdio)

```bash
python mcp/mcp_server.py
```

The process speaks MCP over **stdio** (no HTTP port).

## Tools

| Tool | Purpose |
|------|---------|
| `get_family_tactical_context` | `family_id` (profile UUID) → needs + `selected_matching_result_id` join to `matching_results` + cluster center (mean of statistical area centroids). |
| `search_nearby_amenities` | Embed `query_text`, cosine search on a **whitelisted** table, **filter** by `radius_km` with `ST_DWithin`, return top **5**. |
| `calculate_location_score` | Listing UUID + table + family UUID → distances to schools / synagogues / matnasim + heuristic **0–10** score. |

Allowed `table_name` / `listing_table` values:

`airbnb_listings`, `hotels_listings`, `synagogues`, `educational_institutions`, `matnasim`, `coffee_shops`, `restaurants`, `osm_city_facilities`

## Register in Cursor (MCP)

1. Open **Settings → Features → MCP** (or **Cursor Settings → MCP** depending on version).
2. Edit **MCP servers** JSON and add an entry that runs this server with **stdio**.

Use an **absolute path** to Python and to `mcp_server.py` on your machine.

### Example (global env vars)

```json
{
  "mcpServers": {
    "citystrata-tactical": {
      "command": "python",
      "args": ["C:/Users/YOU/Desktop/.../CityStrata/mcp/mcp_server.py"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Example (rely on project `.env` only)

If `DATABASE_URL` and `OPENAI_API_KEY` are already in the project root `.env`, you can omit `env` and ensure the working directory is correct:

```json
{
  "mcpServers": {
    "citystrata-tactical": {
      "command": "python",
      "args": ["C:/Users/YOU/Desktop/.../CityStrata/mcp/mcp_server.py"],
      "cwd": "C:/Users/YOU/Desktop/.../CityStrata"
    }
  }
}
```

Restart Cursor or reload MCP after saving. The server should appear as **citystrata-tactical** (or whatever key you used).

## Troubleshooting

- **`ModuleNotFoundError: mcp`**: run `pip install -r mcp/requirements.txt` in the same Python environment as `command`.
- **DB SSL (Supabase)**: use the pooled connection string your backend uses; often `?sslmode=require`.
- **Missing columns**: this server expects the CityStrata schema (evacuee profiles + matching_results + cluster_assignments + statistical_areas + embedded asset tables).
