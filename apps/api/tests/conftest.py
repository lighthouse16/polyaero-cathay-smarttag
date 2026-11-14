import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from app.core.database import Base, engine


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


@pytest.fixture(autouse=True)
async def dispose_engine():
    """Each test gets a fresh event loop, so the pooled connections must go."""
    yield
    await engine.dispose()
