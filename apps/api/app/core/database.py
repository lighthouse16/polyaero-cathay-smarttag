import ssl
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()


def get_database_connect_args() -> dict[str, Any]:
    if not settings.database_ssl_ca_file:
        return {}
    if make_url(settings.database_url).get_driver_name() == "asyncpg":
        return {"ssl": ssl.create_default_context(cafile=settings.database_ssl_ca_file)}
    return {"sslmode": "verify-full", "sslrootcert": settings.database_ssl_ca_file}


engine = create_async_engine(
    settings.database_url,
    connect_args=get_database_connect_args(),
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
