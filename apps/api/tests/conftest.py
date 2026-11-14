import os
from datetime import date
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from app.core.database import Base, engine, get_db
from app.core.security import get_current_user
from app.main import app
from app.models.auth import User
from app.seed import seed_database


@pytest.fixture
def seed_engine():
    url = os.environ.get("SEED_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set SEED_TEST_DATABASE_URL to an isolated PostgreSQL test database")
    schema = f"seed_test_{uuid4().hex}"
    test_engine = create_engine(url, execution_options={"schema_translate_map": {None: schema}})
    try:
        with test_engine.begin() as connection:
            connection.execute(CreateSchema(schema))
            Base.metadata.create_all(connection)
        yield test_engine
    finally:
        with test_engine.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True, if_exists=True))
        test_engine.dispose()


@pytest.fixture
async def client(seed_engine, monkeypatch):
    with Session(seed_engine) as session, session.begin():
        seed_database(session, date(2026, 11, 14))
    with Session(seed_engine) as session:
        current_user = session.scalar(
            select(User).where(User.email == "seed.passenger.1@example.com")
        )
    assert current_user is not None
    test_engine = create_async_engine(
        seed_engine.url.set(drivername="postgresql+asyncpg"),
        execution_options=seed_engine.get_execution_options(),
    )

    async def db_dependency():
        async with AsyncSession(test_engine, expire_on_commit=False) as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, db_dependency)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: current_user)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        await test_engine.dispose()


@pytest.fixture(autouse=True)
async def dispose_engine():
    """Each test gets a fresh event loop, so the pooled connections must go."""
    yield
    await engine.dispose()
