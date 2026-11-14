#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="$(gcloud config get-value project 2>/dev/null)"
read -rp "Google Cloud project ID [${PROJECT}]: " INPUT_PROJECT
PROJECT="${INPUT_PROJECT:-$PROJECT}"
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
    echo "Select a Google Cloud project with billing enabled first."
    exit 1
fi
gcloud config set project "$PROJECT"

REGION=asia-east2
NAME=smarttag-demo
echo "This creates billable Cloud Run, Cloud NAT, static IP, build, and secret resources."
echo "Region: ${REGION}. Public API: demo data only."
read -rp "Type yes to continue: " CONFIRM
[[ "$CONFIRM" == yes ]] || exit 1

gcloud services enable run.googleapis.com compute.googleapis.com \
    cloudbuild.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com iam.googleapis.com

gcloud compute networks create "${NAME}-net" --subnet-mode=custom
gcloud compute networks subnets create "${NAME}-subnet" \
    --network="${NAME}-net" --region="$REGION" --range=10.42.0.0/26
gcloud compute routers create "${NAME}-router" \
    --network="${NAME}-net" --region="$REGION"
gcloud compute addresses create "${NAME}-ip" --region="$REGION"
gcloud compute routers nats create "${NAME}-nat" \
    --router="${NAME}-router" --region="$REGION" \
    --nat-custom-subnet-ip-ranges="${NAME}-subnet" \
    --nat-external-ip-pool="${NAME}-ip"

OUTBOUND_IP="$(gcloud compute addresses describe "${NAME}-ip" \
    --region="$REGION" --format='value(address)')"
echo
echo "AWS RDS security group: add PostgreSQL TCP 5432, source ${OUTBOUND_IP}/32."
echo "Keep your computer's My IP rule too. Never allow 0.0.0.0/0."
read -rp "Type yes after adding the AWS rule: " CONFIRM
[[ "$CONFIRM" == yes ]] || exit 1

read -rp "AWS RDS endpoint hostname (no https://): " RDS_HOST
read -rp "Database name [smarttag]: " DB_NAME
DB_NAME="${DB_NAME:-smarttag}"
read -rp "Database username [smarttag_admin]: " DB_USER
DB_USER="${DB_USER:-smarttag_admin}"
read -rsp "Database password (hidden): " DB_PASSWORD
echo
[[ "$RDS_HOST" == *.rds.amazonaws.com && -n "$DB_PASSWORD" ]] || {
    echo "An RDS hostname and password are required."
    exit 1
}
DATABASE_URL="$(printf '%s' "$DB_PASSWORD" | python3 -c '
import sys
from urllib.parse import quote
user, host, database = sys.argv[1:]
password = sys.stdin.read()
print("postgresql+asyncpg://{}:{}@{}:5432/{}".format(
    quote(user, safe=""), quote(password, safe=""), host, quote(database, safe="")
))
' "$DB_USER" "$RDS_HOST" "$DB_NAME")"
unset DB_PASSWORD

printf '%s' "$DATABASE_URL" | gcloud secrets create "${NAME}-database-url" \
    --replication-policy=automatic --data-file=-
unset DATABASE_URL
python3 -c 'import secrets; print(secrets.token_urlsafe(48), end="")' |
    gcloud secrets create "${NAME}-secret-key" --replication-policy=automatic --data-file=-
python3 -c 'import secrets; print(secrets.token_urlsafe(32), end="")' |
    gcloud secrets create "${NAME}-device-key" --replication-policy=automatic --data-file=-

gcloud iam service-accounts create "${NAME}-runtime" \
    --display-name="SmartTag demo runtime"
RUNTIME="${NAME}-runtime@${PROJECT}.iam.gserviceaccount.com"
for SECRET in database-url secret-key device-key; do
    gcloud secrets add-iam-policy-binding "${NAME}-${SECRET}" \
        --member="serviceAccount:${RUNTIME}" --role=roles/secretmanager.secretAccessor
done

gcloud iam service-accounts create "${NAME}-build" \
    --display-name="SmartTag demo container builder"
BUILD_ACCOUNT="${NAME}-build@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${BUILD_ACCOUNT}" --role=roles/cloudbuild.builds.builder >/dev/null
gcloud artifacts repositories create "$NAME" \
    --repository-format=docker --location="$REGION"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${NAME}/api:demo"
gcloud builds submit . --tag="$IMAGE" --region="$REGION" \
    --service-account="projects/${PROJECT}/serviceAccounts/${BUILD_ACCOUNT}" \
    --default-buckets-behavior=regional-user-owned-bucket

SECRETS="DATABASE_URL=${NAME}-database-url:latest,SECRET_KEY=${NAME}-secret-key:latest,IOT_DEVICE_KEY=${NAME}-device-key:latest"
gcloud run jobs deploy "${NAME}-migrate" --image="$IMAGE" --region="$REGION" \
    --service-account="$RUNTIME" \
    --network="${NAME}-net" --subnet="${NAME}-subnet" --vpc-egress=all-traffic \
    --set-secrets="$SECRETS" --set-env-vars=DEBUG=false \
    --command=/app/.venv/bin/alembic --args=upgrade,head \
    --tasks=1 --max-retries=0 --task-timeout=300s --memory=512Mi --cpu=1
gcloud run jobs execute "${NAME}-migrate" --region="$REGION" --wait

gcloud run deploy "$NAME" --image="$IMAGE" --region="$REGION" \
    --service-account="$RUNTIME" \
    --network="${NAME}-net" --subnet="${NAME}-subnet" --vpc-egress=all-traffic \
    --set-secrets="$SECRETS" --set-env-vars=DEBUG=false \
    --allow-unauthenticated --execution-environment=gen2 \
    --min-instances=0 --max-instances=1 --concurrency=8 \
    --memory=512Mi --cpu=1 --timeout=60s

URL="$(gcloud run services describe "$NAME" --region="$REGION" --format='value(status.url)')"
curl --fail --silent --show-error "${URL}/health"
echo
DAY="$(python3 -c 'from datetime import datetime, timezone; print(datetime.now(timezone.utc).date())')"
curl --fail --silent --show-error "${URL}/api/v1/flights/search" \
    -H 'Content-Type: application/json' \
    --data "{\"origin\":\"HKG\",\"destination\":\"NRT\",\"departure_date\":\"${DAY}\",\"trip_type\":\"ONE_WAY\"}"
echo
echo "API URL: ${URL}/api/v1"
echo "API docs: ${URL}/api/v1/docs"
echo "Prototype only: baggage memory resets on restart; OTP providers and passkey origins still need configuration."
echo "Device key is in Secret Manager: ${NAME}-device-key. Do not put it in public mobile configuration."
echo "Delete demo resources after the hackathon; cleanup instructions are in README.md."
