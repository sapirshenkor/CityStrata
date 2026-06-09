#!/usr/bin/env bash
# Render start command: bash run.sh  (or: uvicorn app.main:app --host 0.0.0.0 --port $PORT)
set -euo pipefail
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
