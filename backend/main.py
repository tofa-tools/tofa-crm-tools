"""
Main entry point for FastAPI application.
This file imports from fastapi_app to maintain backward compatibility.
"""
from backend.fastapi_app import app

# Re-export app for backward compatibility
__all__ = ["app"]
