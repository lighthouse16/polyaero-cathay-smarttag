import pytest

from app.core.database import engine


@pytest.fixture(autouse=True)
async def dispose_engine():
    """Each test gets a fresh event loop, so the pooled connections must go."""
    yield
    await engine.dispose()
