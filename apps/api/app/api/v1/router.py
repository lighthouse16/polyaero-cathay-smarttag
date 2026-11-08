from fastapi import APIRouter

from app.api.v1.endpoints import baggage, tags

api_router = APIRouter()

api_router.include_router(baggage.router, prefix="/baggage", tags=["baggage"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
