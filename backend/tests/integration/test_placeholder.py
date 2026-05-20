"""
Opt-in integration tests (real database).

Run explicitly with:
    pytest -m integration
"""

import pytest


@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.skip(reason="Requires DATABASE_URL_TEST and isolated Postgres — not enabled by default")
async def test_database_smoke_placeholder():
    """Reserved for future isolated-DB checks; never runs against production."""
    assert True
