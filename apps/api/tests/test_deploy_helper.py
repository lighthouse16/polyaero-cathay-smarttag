import importlib.util
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

spec = importlib.util.spec_from_file_location(
    "deploy_cloudrun_demo", Path(__file__).resolve().parents[1] / "deploy_cloudrun_demo.py"
)
assert spec is not None and spec.loader is not None
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def test_database_environment_encodes_password():
    environment = helper.database_environment(
        "demo.example.rds.amazonaws.com", "demo", "smarttag", "pass:@/#?"
    )
    assert make_url(environment["DATABASE_URL"]).password == "pass:@/#?"
    with pytest.raises(ValueError):
        helper.database_environment("localhost", "demo", "smarttag", "password")
    with pytest.raises(ValueError):
        helper.database_environment("demo.example.rds.amazonaws.com", "demo", "smarttag", "")


@pytest.mark.parametrize("migration_fails", [False, True])
def test_deploy_cleans_credentials_and_stops_on_migration_failure(monkeypatch, migration_fails):
    calls = []
    credential_paths = []

    def fake_gcloud(*args, capture=False):
        calls.append(args)
        for arg in args:
            if arg.startswith("--env-vars-file="):
                path = Path(arg.split("=", 1)[1])
                assert path.exists()
                credential_paths.append(path)
        if args[:3] == ("run", "jobs", "execute") and migration_fails:
            raise RuntimeError("Migration failed")
        return "https://demo.run.app" if capture else ""

    monkeypatch.setattr(helper, "gcloud", fake_gcloud)
    if migration_fails:
        with pytest.raises(RuntimeError, match="Migration failed"):
            helper.deploy("demo", "asia-east2", "smarttag-demo", {"DEBUG": "false"})
    else:
        assert helper.deploy(
            "demo", "asia-east2", "smarttag-demo", {"DEBUG": "false"}
        ) == "https://demo.run.app"
    assert credential_paths and all(not path.exists() for path in credential_paths)
    assert any(call[:2] == ("run", "deploy") for call in calls) is not migration_fails
    assert not any("add-iam-policy-binding" in call for call in calls)
