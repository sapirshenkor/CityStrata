"""database connection"""

"""
This module provides a global database connection pool for the application.
It uses asyncpg to create a pool of connections to the database.
The pool is created once on app startup and is closed on app shutdown.
The pool is used to execute queries and transactions on the database.
"""

import asyncpg
from asyncpg.pool import Pool

from app.core.config import settings

_pool: Pool | None = None


async def init_db_pool() -> Pool:
    """
    Creates a global asyncpg connection pool.
    Called once on app startup.
    """
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=1,
            max_size=10,
            command_timeout=30,
            statement_cache_size=0,
        )
    return _pool


async def close_db_pool() -> None:
    """
    Closes the global pool on app shutdown.
    """
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> Pool:
    """
    Returns the initialized pool (raises if not initialized).
    """
    if _pool is None:
        raise RuntimeError(
            "DB pool is not initialized. Did you start the app properly?"
        )
    return _pool
