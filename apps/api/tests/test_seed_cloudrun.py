import copy
import importlib.util
import json
from datetime import date
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "seed_cloudrun", Path(__file__).resolve().parents[1] / "seed_cloudrun.py"
)
assert spec is not None and spec.loader is not None
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


@pytest.fixture
def migration():
    return {
        "metadata": {"name": "demo-migrate", "uid": "do-not-copy"},
        "spec": {"template": {
            "metadata": {"name": "old-execution", "annotations": {"network": "demo-net"}},
            "spec": {"taskCount": 3, "parallelism": 3, "template": {"spec": {
                "serviceAccountName": "runtime@example.com",
                "maxRetries": 3,
                "containers": [{
                    "image": "old-image",
                    "command": ["alembic"],
                    "args": ["upgrade", "head"],
                    "env": [
                        {"name": "DATABASE_URL", "value": "postgresql://demo:fake@db/smarttag"},
                        {"name": "DATABASE_SSL_CA_FILE", "value": "/app/certs/rds-ca.pem"},
                        {"name": "SECRET_KEY", "value": "existing-key"},
                    ],
                }],
            }}},
        }},
    }


def test_clone_preserves_database_network_and_identity(migration):
    original = copy.deepcopy(migration)
    job = helper.seed_job(migration, "demo-seed", "new-image", date(2026, 11, 14))
    assert migration == original
    assert job["metadata"] == {"name": "demo-seed"}
    template = job["spec"]["template"]
    assert template["metadata"] == {"annotations": {"network": "demo-net"}}
    task = template["spec"]["template"]["spec"]
    assert task["serviceAccountName"] == "runtime@example.com"
    container = task["containers"][0]
    assert container["env"][:3] == original["spec"]["template"]["spec"]["template"]["spec"][
        "containers"
    ][0]["env"]
    assert container["command"] == ["/app/.venv/bin/python"]
    assert container["args"] == ["-m", "app.seed", "--date", "2026-11-14"]
    container["env"].clear()
    with pytest.raises(ValueError, match="DATABASE_URL"):
        helper.seed_job(job, "demo-seed", "new-image", date(2026, 11, 14))


@pytest.mark.parametrize("outcome", ["success", "preview-fails", "apply-fails", "declined"])
def test_preview_apply_and_credential_cleanup(monkeypatch, migration, outcome):
    replacements = []
    paths = []
    executions = []

    def fake_gcloud(*args, capture=False):
        if args[:3] == ("run", "jobs", "describe"):
            return json.dumps(migration)
        if args[:3] == ("run", "jobs", "replace"):
            path = Path(args[3])
            paths.append(path)
            replacements.append(json.loads(path.read_text()))
        if args[:3] == ("run", "jobs", "execute"):
            container = replacements[-1]["spec"]["template"]["spec"]["template"]["spec"][
                "containers"
            ][0]
            applying = "--apply" in container["args"]
            executions.append(applying)
            if outcome == "preview-fails" or (outcome == "apply-fails" and applying):
                raise RuntimeError("Execution failed")
        return ""

    monkeypatch.setattr(helper, "gcloud", fake_gcloud)
    monkeypatch.setattr(
        "sys.argv",
        ["seed_cloudrun", "--project=demo", "--image=new-image", "--date=2026-11-14"],
    )
    answers = iter(["yes", "cancel" if outcome == "declined" else "apply"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    monkeypatch.setattr(helper.getpass, "getpass", lambda _: "PrivateDemo!42")
    if outcome in {"preview-fails", "apply-fails"}:
        with pytest.raises(RuntimeError, match="Execution failed"):
            helper.main()
    else:
        helper.main()
    assert executions == ([False, True] if outcome in {"success", "apply-fails"} else [False])
    assert paths and all(not path.exists() for path in paths)
    final = replacements[-1]["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]
    assert "--apply" not in final["args"]
    assert not any(item["name"] == "SEED_USER_PASSWORD" for item in final["env"])
