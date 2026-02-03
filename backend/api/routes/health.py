"""
Health check routes.
"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }


@router.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes."""
    return {
        "ready": True,
        "timestamp": datetime.now().isoformat()
    }
