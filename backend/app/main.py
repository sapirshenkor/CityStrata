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

    # CORS: axios does not use withCredentials, so allow_credentials=False.
    # Vercel preview/production hosts match allow_origin_regex; local Vite/React dev ports are explicit.
    # Set CORS_EXTRA_ORIGINS=https://citystrata.example.com for custom frontend domains.
    # Set CORS_ALLOW_ALL=1 only for unrestricted local debugging (not for production).
    _default_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    _extra = os.environ.get("CORS_EXTRA_ORIGINS", "").strip()
    if _extra:
        _default_origins.extend(o.strip() for o in _extra.split(",") if o.strip())

    if os.environ.get("CORS_ALLOW_ALL", "0") == "1":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=_default_origins,
            allow_origin_regex=r"https://.*\.vercel\.app",
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Include API router
    app.include_router(api_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
