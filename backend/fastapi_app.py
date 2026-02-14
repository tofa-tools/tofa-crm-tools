"""
FastAPI application - Main Switchboard.
All route logic lives in backend.api modules.
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from backend.core.db import get_session_sync, create_db_and_tables
from backend.api.deps import limiter

# Sentry (optional)
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    if SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            traces_sample_rate=0.1,
            environment=os.getenv("ENVIRONMENT", "development"),
        )
        print("Sentry error tracking initialized")
    else:
        print("Sentry DSN not provided, error tracking disabled")
except ImportError:
    print("Sentry SDK not installed")

app = FastAPI(redirect_slashes=False)

origins = [
    "https://web-ol2p4uejfa-el.a.run.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
cors_origins_env = os.getenv("CORS_ORIGINS", "").strip()
if cors_origins_env:
    origins = list(origins) + [o.strip() for o in cors_origins_env.split(";") if o.strip()]
cors_origin_regex = r"^https://[\w-]+(-[\w]+)*\.(run\.app|a\.run\.app)(:\d+)?$"
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.state.limiter = limiter


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many login attempts. Please try again in a minute.", "error": "rate_limit_exceeded"},
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        raise exc
    import traceback
    import logging
    logging.getLogger("uvicorn.error").error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if os.getenv("ENVIRONMENT") == "development" else "Internal server error"},
        headers={"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"},
    )


@app.middleware("http")
async def proxy_headers_middleware(request: Request, call_next):
    forwarded_proto = request.headers.get("x-forwarded-proto")
    if forwarded_proto and forwarded_proto.lower() == "https":
        request.scope["scheme"] = "https"
    return await call_next(request)


@app.middleware("http")
async def observer_read_only_middleware(request: Request, call_next):
    if request.method in ["GET", "OPTIONS", "HEAD"]:
        return await call_next(request)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from backend.core.auth import get_user_email_from_token
            from backend.core.users import get_user_by_email
            email = get_user_email_from_token(token)
            if email:
                db = get_session_sync()
                try:
                    user = get_user_by_email(db, email)
                    if user and user.role == "observer":
                        return JSONResponse(status_code=403, content={"detail": "Observers have read-only access"})
                finally:
                    db.close()
        except Exception:
            pass
    return await call_next(request)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    print("API Security: Allowing requests from:", origins)


# --- Router registration ---
from backend.api import users, centers, batches, leads, students, analytics
from backend.api import attendance, approvals, notifications, public, webhooks, tasks

app.include_router(users.router, tags=["Users", "Auth"])
app.include_router(centers.router, prefix="/centers", tags=["Centers"])
app.include_router(batches.router, prefix="/batches", tags=["Batches"])
app.include_router(leads.router, prefix="/leads", tags=["Leads"])
app.include_router(leads.staging_router, prefix="/staging", tags=["Leads"])
app.include_router(students.router, prefix="/students", tags=["Students"])
app.include_router(students.subscriptions_router, prefix="/subscriptions", tags=["Students"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
app.include_router(approvals.router, prefix="/approvals", tags=["Approvals"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(public.router, prefix="/public", tags=["Public"])
app.include_router(webhooks.router, prefix="/webhook", tags=["Webhooks"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
app.include_router(tasks.calendar_router, prefix="/calendar", tags=["Calendar"])
app.include_router(tasks.user_stats_router, prefix="/user/stats", tags=["User Stats"])
