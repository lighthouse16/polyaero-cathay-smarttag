import ssl
from types import SimpleNamespace

import certifi
import pytest

import app.main as main
from app.core import database


def test_database_tls_verifies_server_identity(monkeypatch):
    monkeypatch.setattr(
        database,
        "settings",
        SimpleNamespace(
            database_url="postgresql+asyncpg://localhost/smarttag",
            database_ssl_ca_file=certifi.where(),
        ),
    )
    context = database.get_database_connect_args()["ssl"]
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname


def test_database_tls_rejects_missing_ca(monkeypatch, tmp_path):
    monkeypatch.setattr(
        database,
        "settings",
        SimpleNamespace(
            database_url="postgresql+asyncpg://localhost/smarttag",
            database_ssl_ca_file=str(tmp_path / "missing.pem"),
        ),
    )
    with pytest.raises(FileNotFoundError):
        database.get_database_connect_args()


@pytest.mark.parametrize("debug", [True, False])
async def test_startup_database_failure_only_allowed_in_debug(monkeypatch, debug):
    async def unavailable():
        raise ConnectionError("Database unavailable")

    monkeypatch.setattr(main, "settings", SimpleNamespace(debug=debug))
    monkeypatch.setattr(main, "init_db", unavailable)
    if debug:
        async with main.lifespan(main.app):
            pass
    else:
        with pytest.raises(ConnectionError):
            async with main.lifespan(main.app):
                pass
