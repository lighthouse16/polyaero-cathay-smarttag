"""Seed the hackathon database through a separate Cloud Run job."""

import argparse
import copy
import getpass
import json
import subprocess
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit


def gcloud(*args: str, capture: bool = False) -> str:
    result = subprocess.run(
        ["gcloud", *args], check=True, text=True, capture_output=capture
    )
    return result.stdout if capture else ""


def seed_job(source: dict, name: str, image: str, day: date) -> dict:
    template = copy.deepcopy(source["spec"]["template"])
    template["metadata"] = {"annotations": template.get("metadata", {}).get("annotations", {})}
    execution = template["spec"]
    execution["taskCount"] = execution["parallelism"] = 1
    task = execution["template"]["spec"]
    if len(task["containers"]) != 1:
        raise ValueError("The migration job must have exactly one container")
    container = task["containers"][0]
    environment = container.get("env", [])
    if not any(item["name"] == "DATABASE_URL" for item in environment):
        raise ValueError("The migration job has no DATABASE_URL; refusing the local default")
    container["image"] = image
    container["command"] = ["/app/.venv/bin/python"]
    container["args"] = ["-m", "app.seed", "--date", day.isoformat()]
    container["env"] = [
        item for item in environment
        if item["name"] not in {"SEED_USER_PASSWORD", "DEBUG", "PYTHONUNBUFFERED"}
    ] + [
        {"name": "DEBUG", "value": "false"},
        {"name": "PYTHONUNBUFFERED", "value": "1"},
    ]
    task["maxRetries"] = 0
    task["timeoutSeconds"] = "300"
    return {
        "apiVersion": "run.googleapis.com/v1",
        "kind": "Job",
        "metadata": {"name": name},
        "spec": {"template": template},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--image", required=True, help="Newly built image containing app.seed")
    parser.add_argument("--region", default="asia-east2")
    parser.add_argument("--name", default="smarttag-demo")
    parser.add_argument("--date", type=date.fromisoformat, required=True)
    args = parser.parse_args()
    flags = [f"--project={args.project}", f"--region={args.region}", "--quiet"]
    print("Demo only: credentials are visible to users who can inspect job/execution configuration.")
    print("The API and migration job will not be changed. Cloud Run jobs are billable.")
    if input("Type yes to create/update and preview the seed job: ").strip() != "yes":
        return
    source = json.loads(gcloud(
        "run", "jobs", "describe", f"{args.name}-migrate", *flags,
        "--format=json", capture=True,
    ))
    name = f"{args.name}-seed"
    job = seed_job(source, name, args.image, args.date)
    container = job["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]
    database = next(item for item in container["env"] if item["name"] == "DATABASE_URL")
    if "value" in database:
        url = urlsplit(database["value"])
        print(f"Target: {url.hostname}:{url.port or 5432}{url.path}")
    else:
        print("Target: DATABASE_URL secret inherited from the migration job.")

    with tempfile.TemporaryDirectory(prefix="smarttag-seed-") as directory:
        path = Path(directory) / "job.json"

        def replace() -> None:
            with path.open("w", encoding="utf-8") as file:
                path.chmod(0o600)
                json.dump(job, file)
            gcloud("run", "jobs", "replace", str(path), *flags)

        def execute() -> None:
            gcloud("run", "jobs", "execute", name, *flags, "--wait")
            gcloud("run", "jobs", "logs", "read", name, *flags, "--limit=50")

        replace()
        execute()
        print("Preview does not connect to the database. Apply inserts synthetic active members.")
        password = getpass.getpass("Private demo login password (hidden): ")
        if len(password) < 8 or len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be at least 8 characters and at most 72 UTF-8 bytes")
        if password != getpass.getpass("Confirm demo password (hidden): "):
            raise ValueError("Passwords do not match")
        if input("Type apply to insert into the displayed database: ").strip() != "apply":
            return
        container["args"].append("--apply")
        container["env"].append({"name": "SEED_USER_PASSWORD", "value": password})
        try:
            replace()
            execute()
            print("Seed execution succeeded. Check the committed row counts above.")
        finally:
            container["args"].remove("--apply")
            container["env"] = [
                item for item in container["env"] if item["name"] != "SEED_USER_PASSWORD"
            ]
            replace()
    print("Password removed from current job config; prior execution metadata may retain it.")


if __name__ == "__main__":
    main()
