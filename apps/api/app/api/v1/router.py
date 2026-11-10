from fastapi import APIRouter

from app.api.v1.endpoints import auth, baggage, passkey, tags

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(passkey.router, prefix="/auth")
api_router.include_router(baggage.router, prefix="/baggage", tags=["baggage"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
