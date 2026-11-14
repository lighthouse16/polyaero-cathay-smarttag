FROM ghcr.io/astral-sh/uv:latest AS uv
FROM python:3.13-slim

COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    DEBUG=false \
    DATABASE_SSL_CA_FILE=/app/certs/rds-ca.pem

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-ca.pem
COPY app ./app
COPY artifacts/cathay_bag_risk_bundle.joblib ./artifacts/cathay_bag_risk_bundle.joblib
COPY alembic ./alembic
COPY alembic.ini ./
RUN chmod 644 /app/certs/rds-ca.pem

USER 10001:10001
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8080}\" --workers 1"]
