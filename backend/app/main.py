"""main file for running the application"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db_pool, close_db_pool
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for the application"""
    # Startup: Initialize database connection pool
    await init_db_pool()
    yield
    # Shutdown: Close database connection pool
    await close_db_pool()


def create_app() -> FastAPI:
    app = FastAPI(
        title="CityStrata API",
        version="0.1.0",
        description="CityStrata – City classification platform for emergency scenarios (Eilat case study).",
        lifespan=lifespan,
    )

    # CORS: `allow_origins=["*"]` with `allow_credentials=True` is disallowed; browsers/Starlette
    # can omit Access-Control-Allow-Origin on 4xx, so the frontend sees a "network" error. The
    # frontend (axios) does not use withCredentials, so we use allow_credentials=False; then
    # wildcard origins are valid. This also covers all dev hostnames: localhost, 127.0.0.1, ::1, LAN.
    #
    # Set CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 to restrict, and
    # CORS_WITH_CREDENTIALS=1 if you need cookies (cannot use * with that).
    _cors = os.environ.get("CORS_ORIGINS", "*").strip()
    if _cors == "*":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        _origins = [o.strip() for o in _cors.split(",") if o.strip()]
        _cred = os.environ.get("CORS_WITH_CREDENTIALS", "0") == "1"
        app.add_middleware(
            CORSMiddleware,
            allow_origins=_origins,
            allow_credentials=_cred,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Include API router
    app.include_router(api_router)

    return app


app = create_app()
