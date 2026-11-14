"""Resume the demo deployment without Secret Manager or IAM changes."""

import argparse
import getpass
import json
import re
import secrets
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


def database_environment(host: str, user: str, database: str, password: str) -> dict[str, str]:
    if not re.fullmatch(r"[a-zA-Z0-9.-]+\.rds\.amazonaws\.com", host):
        raise ValueError("Enter the RDS hostname only, ending in .rds.amazonaws.com")
    if not user or not database or not password:
        raise ValueError("Database username, name, and password are required")
    return {
        "DATABASE_URL": (
            f"postgresql+asyncpg://{quote(user, safe='')}:{quote(password, safe='')}"
            f"@{host}:5432/{quote(database, safe='')}"
        ),
        "DEBUG": "false",
        "SECRET_KEY": secrets.token_urlsafe(48),
        "IOT_DEVICE_KEY": secrets.token_urlsafe(32),
    }


def gcloud(*args: str, capture: bool = False) -> str:
    result = subprocess.run(
        ["gcloud", *args], check=True, text=True, capture_output=capture
    )
    return result.stdout.strip() if capture else ""


def deploy(project: str, region: str, name: str, environment: dict[str, str]) -> str:
    image = f"{region}-docker.pkg.dev/{project}/{name}/api:demo"
    common = [
        f"--project={project}",
        f"--region={region}",
        f"--image={image}",
        f"--service-account={name}-runtime@{project}.iam.gserviceaccount.com",
        f"--network={name}-net",
        f"--subnet={name}-subnet",
        "--vpc-egress=all-traffic",
        "--memory=512Mi",
        "--cpu=1",
        "--quiet",
    ]
    with tempfile.TemporaryDirectory(prefix="smarttag-deploy-") as directory:
        path = Path(directory) / "environment.json"
        with path.open("x", encoding="utf-8") as file:
            path.chmod(0o600)
            json.dump(environment, file)
        common.append(f"--env-vars-file={path}")
        gcloud(
            "run", "jobs", "deploy", f"{name}-migrate", *common,
            "--command=/app/.venv/bin/alembic", "--args=upgrade,head",
            "--tasks=1", "--max-retries=0", "--task-timeout=300s",
        )
        gcloud(
            "run", "jobs", "execute", f"{name}-migrate",
            f"--project={project}", f"--region={region}", "--wait", "--quiet",
        )
        gcloud(
            "run", "deploy", name, *common,
            "--execution-environment=gen2", "--min-instances=0",
            "--max-instances=1", "--concurrency=8", "--timeout=60s",
        )
    return gcloud(
        "run", "services", "describe", name,
        f"--project={project}", f"--region={region}",
        "--format=value(status.url)", capture=True,
    )


def verify(url: str) -> None:
    token = gcloud("auth", "print-identity-token", capture=True)
    headers = {"Authorization": f"Bearer {token}"}
    request = Request(f"{url}/health", headers=headers)
    with urlopen(request, timeout=90) as response:
        if json.load(response).get("status") != "healthy":
            raise RuntimeError("The deployed API did not report healthy")
    request = Request(
        f"{url}/api/v1/flights/search",
        headers={**headers, "Content-Type": "application/json"},
        data=json.dumps({
            "origin": "HKG", "destination": "NRT",
            "departure_date": datetime.now(UTC).date().isoformat(), "trip_type": "ONE_WAY",
        }).encode(),
    )
    with urlopen(request, timeout=90) as response:
        json.load(response)
    print("Health and database-route checks passed.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--region", default="asia-east2")
    parser.add_argument("--name", default="smarttag-demo")
    args = parser.parse_args()
    print("Uses the existing :demo image, network, subnet, and runtime service account.")
    print("Demo only: credentials will be visible to users who can inspect Cloud Run configuration.")
    print("No IAM changes. New services stay private; existing access settings are unchanged.")
    print("Rerunning rotates app/device keys and invalidates existing tokens.")
    if input("Type yes to deploy billable resources: ").strip() != "yes":
        return
    environment = database_environment(
        input("AWS RDS endpoint hostname: ").strip(),
        input("Database username [smarttag_admin]: ").strip() or "smarttag_admin",
        input("Database name [smarttag]: ").strip() or "smarttag",
        getpass.getpass("AWS RDS password (hidden): "),
    )
    url = deploy(args.project, args.region, args.name, environment)
    print(f"Deployed URL: {url}")
    verify(url)
    print(f"API URL: {url}/api/v1")
    print("Temporary credentials file removed. Private access still requires Google authentication.")


if __name__ == "__main__":
    main()
