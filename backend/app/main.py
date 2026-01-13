"""main file for running the application"""

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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API router
    app.include_router(api_router)

    return app


app = create_app()
