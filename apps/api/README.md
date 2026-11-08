# PolyAero Cathay SmartTag API

FastAPI backend for the PolyAero Cathay SmartTag hackathon project.

## Quick Start

### Prerequisites

- Python 3.11+
- uv (package manager): `pip install uv` or `corepack enable uv`
- PostgreSQL 16+

### Install Dependencies

```bash
cd apps/api
uv sync
```

### Environment Configuration

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# Run migrations
uv run alembic upgrade head

# Create a new migration
uv run alembic revision --autogenerate -m "migration description"
```

### Run Development Server

```bash
uv run uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/v1/docs

### Run Tests

```bash
uv run pytest
```

### Code Quality

```bash
# Lint
uv run ruff check .

# Type check
uv run mypy app
```

## Project Structure

```
apps/api/
├── app/
│   ├── core/           # Config, database, security
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas (request/response)
│   ├── api/v1/         # API routes
│   │   └── endpoints/  # Route handlers
│   └── services/       # Business logic
├── alembic/            # Database migrations
├── tests/              # Pytest tests
├── pyproject.toml      # Dependencies & tool config
├── .env.example        # Environment template
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/v1/baggage | Create baggage record |
| GET | /api/v1/baggage/{id} | Get baggage by ID |
| GET | /api/v1/baggage | List baggage |
| PATCH | /api/v1/baggage/{id} | Update baggage |
| DELETE | /api/v1/baggage/{id} | Delete baggage |
| POST | /api/v1/tags | Create SmartTag |
| GET | /api/v1/tags/{id} | Get tag by ID |
| GET | /api/v1/tags | List tags |
| PATCH | /api/v1/tags/{id} | Update tag |
| DELETE | /api/v1/tags/{id} | Delete tag |

## Database Schema

### tags
- `id` (UUID, PK)
- `tag_code` (String, unique) - NFC tag identifier
- `is_active` (Boolean)
- `firmware_version` (String, nullable)
- `hardware_revision` (String, nullable)
- `last_seen_at` (DateTime, nullable)
- `created_at`, `updated_at` (DateTime)

### baggage
- `id` (UUID, PK)
- `passenger_name` (String)
- `flight_number` (String, indexed)
- `departure_airport` (String, 3 chars)
- `arrival_airport` (String, 3 chars)
- `departure_time` (DateTime)
- `seat_number` (String, nullable)
- `status` (String, default: 'checked_in')
- `tag_id` (UUID, FK to tags, nullable, indexed)
- `created_at`, `updated_at` (DateTime)

## Next Steps

- [ ] Implement CRUD operations in endpoints
- [ ] Add authentication/authorization
- [ ] Add baggage milestone events table
- [ ] Integrate with Supabase for realtime (staff portal)
- [ ] Add RAG/agentic AI modules (separate service)