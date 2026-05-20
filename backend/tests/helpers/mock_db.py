"""In-memory asyncpg pool/connection stand-in for deterministic API tests."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

QueryHandler = Callable[[str, tuple[Any, ...]], Any | Awaitable[Any]]


class MockConnection:
    """Minimal asyncpg connection interface used by route handlers."""

    def __init__(self) -> None:
        self.fetch_handlers: list[QueryHandler] = []
        self.fetchrow_handlers: list[QueryHandler] = []
        self.fetchval_handlers: list[QueryHandler] = []
        self.execute_handlers: list[QueryHandler] = []

    def on_fetch(self, handler: QueryHandler) -> QueryHandler:
        self.fetch_handlers.append(handler)
        return handler

    def on_fetchrow(self, handler: QueryHandler) -> QueryHandler:
        self.fetchrow_handlers.append(handler)
        return handler

    def on_fetchval(self, handler: QueryHandler) -> QueryHandler:
        self.fetchval_handlers.append(handler)
        return handler

    def on_execute(self, handler: QueryHandler) -> QueryHandler:
        self.execute_handlers.append(handler)
        return handler

    async def _dispatch(
        self, handlers: list[QueryHandler], query: str, args: tuple[Any, ...]
    ) -> Any:
        for handler in handlers:
            result = handler(query, args)
            if result is not None:
                if isinstance(result, Awaitable):
                    return await result
                return result
        return [] if handlers is self.fetch_handlers else None

    async def fetch(self, query: str, *args: Any) -> list[Any]:
        rows = await self._dispatch(self.fetch_handlers, query, args)
        return rows if rows is not None else []

    async def fetchrow(self, query: str, *args: Any) -> Any | None:
        return await self._dispatch(self.fetchrow_handlers, query, args)

    async def fetchval(self, query: str, *args: Any) -> Any | None:
        return await self._dispatch(self.fetchval_handlers, query, args)

    async def execute(self, query: str, *args: Any) -> str:
        result = await self._dispatch(self.execute_handlers, query, args)
        return result if isinstance(result, str) else "OK"

    def transaction(self) -> _TransactionContext:
        return _TransactionContext(self)


class _TransactionContext:
    def __init__(self, conn: MockConnection) -> None:
        self._conn = conn

    async def __aenter__(self) -> MockConnection:
        return self._conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _AcquireContext:
    def __init__(self, conn: MockConnection) -> None:
        self._conn = conn

    async def __aenter__(self) -> MockConnection:
        return self._conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class MockPool:
    """Stand-in for asyncpg pool; returns a shared MockConnection."""

    def __init__(self, connection: MockConnection | None = None) -> None:
        self.connection = connection or MockConnection()

    def acquire(self) -> _AcquireContext:
        return _AcquireContext(self.connection)
