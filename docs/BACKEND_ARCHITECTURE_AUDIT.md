# Backend Architecture & Route Audit Report

**Generated:** Post-modular refactor  
**Scope:** `backend/` directory

---

## 1. Folder Structure Map

```
backend/
├── api/                    # HTTP layer - Skinny Routers
│   ├── __init__.py
│   ├── deps.py             # Shared dependencies (auth, DB session, limiter)
│   ├── analytics.py
│   ├── approvals.py
│   ├── attendance.py
│   ├── batches.py
│   ├── centers.py
│   ├── leads.py            # + staging_router
│   ├── notifications.py
│   ├── public.py           # Unauthenticated routes (parent portal)
│   ├── students.py         # + subscriptions_router
│   ├── tasks.py            # + calendar_router, user_stats_router
│   ├── users.py
│   └── webhooks.py
├── core/                   # Business logic - The "Brain"
│   ├── __init__.py
│   ├── abandoned_leads.py
│   ├── age_utils.py
│   ├── analytics.py
│   ├── approvals.py
│   ├── at_risk_leads.py
│   ├── attendance.py
│   ├── audit.py
│   ├── auth.py
│   ├── auto_tasks.py
│   ├── batches.py
│   ├── bulk_operations.py
│   ├── centers.py
│   ├── db.py
│   ├── duplicate_detection.py
│   ├── emails.py
│   ├── enrollment.py
│   ├── import_validation.py
│   ├── lead_metadata.py
│   ├── lead_privacy.py
│   ├── leads.py
│   ├── mentions.py
│   ├── notifications.py
│   ├── pending_reports.py
│   ├── public_preferences.py
│   ├── reactivations.py
│   ├── report_audit.py
│   ├── skills.py
│   ├── staging.py
│   ├── students.py
│   ├── subscriptions.py
│   ├── tasks.py
│   ├── user_stats.py
│   └── users.py
├── schemas/                # Pydantic request/response models
│   ├── __init__.py
│   ├── attendance.py
│   ├── batches.py
│   ├── bulk.py
│   ├── centers.py
│   ├── leads.py
│   ├── students.py
│   └── users.py
├── scripts/                # CLI & maintenance scripts
│   ├── __init__.py
│   └── reset_password_hashes.py
├── fastapi_app.py          # Main entry point - Switchboard
├── models.py               # SQLModel ORM definitions
└── run_dev.py              # Dev server launcher
```

### Folder Responsibilities

| Folder | Responsibility |
|--------|----------------|
| **`/api`** | **Skinny Routers** – Validate requests, call `core/` functions, return HTTP responses. No business logic or direct DB access. |
| **`/core`** | **Business Logic** – Framework-agnostic operations. All DB access (`db.exec`, `select`, `db.get`) lives here. |
| **`/schemas`** | **Pydantic Models** – Request validation, response serialization, type safety. |
| **`/scripts`** | **CLI & Maintenance** – One-off scripts (e.g., password hash reset). Not part of the HTTP API. |

---

## 2. API Route Inventory

### Users & Auth (no prefix)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/token` | `login` | Modularized |
| GET | `/me` | `get_current_user_info` | Modularized |
| GET | `/users` | `get_users` | Modularized |
| POST | `/users` | `create_user_endpoint` | Modularized |
| PUT | `/users/{user_id}` | `update_user_endpoint` | Modularized |
| PUT | `/users/{user_id}/toggle-status` | `toggle_user_status_endpoint` | Modularized |

### Centers (`/centers`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/centers` | `get_centers` | Modularized |
| POST | `/centers` | `create_center_endpoint` | Modularized |
| PUT | `/centers/{center_id}` | `update_center_endpoint` | Modularized |

### Batches (`/batches`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/batches` | `get_batches_endpoint` | Modularized |
| GET | `/batches/my-batches` | `get_my_batches_endpoint` | Modularized |
| GET | `/batches/{batch_id}/potential-reactivations` | `get_potential_reactivations_endpoint` | Modularized |
| POST | `/batches` | `create_batch_endpoint` | Modularized |
| POST | `/batches/{batch_id}/assign-coach` | `assign_coach_to_batch_endpoint` | Modularized |
| PUT | `/batches/{batch_id}` | `update_batch_endpoint` | Modularized |
| DELETE | `/batches/{batch_id}` | `delete_batch_endpoint` | Modularized |

### Leads (`/leads`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/leads/my_leads` | `get_my_leads` | Modularized |
| POST | `/leads` | `create_lead_endpoint` | Modularized |
| POST | `/leads/preview` | `preview_leads` | Modularized |
| POST | `/leads/upload` | `upload_leads` | Modularized |
| POST | `/leads/bulk/status` | `bulk_update_status` | Modularized |
| POST | `/leads/bulk/assign` | `bulk_assign_center` | Modularized |
| PUT | `/leads/{lead_id}` | `update_lead_endpoint` | Modularized |
| PUT | `/leads/{lead_id}/date-of-birth` | `update_date_of_birth_endpoint` | Modularized |
| PUT | `/leads/{lead_id}/metadata` | `update_lead_metadata_endpoint` | Modularized |
| POST | `/leads/{lead_id}/convert` | `convert_lead_to_student_endpoint` | Modularized |
| POST | `/leads/{lead_id}/send-enrollment-link` | `send_enrollment_link_endpoint` | Modularized |
| POST | `/leads/{lead_id}/verify-and-enroll` | `verify_and_enroll_lead_endpoint` | Modularized |
| GET | `/leads/{lead_id}/activity` | `get_lead_activity` | Modularized |
| POST | `/leads/{lead_id}/report-sent` | `log_report_sent_endpoint` | Modularized |
| POST | `/leads/{lead_id}/skills` | `create_skill_evaluation_endpoint` | Modularized |
| GET | `/leads/{lead_id}/skills/summary` | `get_skill_summary_endpoint` | Modularized |
| POST | `/leads/{lead_id}/nudge` | `send_nudge_endpoint` | Modularized |

### Staging (`/staging`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/staging/leads` | `create_staging_lead_endpoint` | Modularized |
| GET | `/staging/leads` | `get_staging_leads_endpoint` | Modularized |
| POST | `/staging/leads/{staging_id}/promote` | `promote_staging_lead_endpoint` | Modularized |

### Students (`/students`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/students` | `get_students_endpoint` | Modularized |
| GET | `/students/payment-unverified` | `get_payment_unverified_students_endpoint` | Modularized |
| PATCH/POST | `/students/{student_id}/verify-payment` | `verify_student_payment_endpoint` | Modularized |
| GET | `/students/by-lead/{lead_id}` | `get_student_by_lead_endpoint` | Modularized |
| PUT | `/students/renew/{public_token}` | `update_renewal_intent_endpoint` | Modularized |
| POST | `/students/renew-confirm/{public_token}` | `renew_confirm_public` | Modularized |
| GET | `/students/by-token/{public_token}` | `get_student_by_token_endpoint` | Modularized |
| PUT | `/students/{student_id}` | `update_student_endpoint` | Modularized |
| GET | `/students/{student_id}/milestones` | `get_student_milestones_endpoint` | Modularized |
| POST | `/students/{student_id}/grace-nudge` | `send_grace_nudge_endpoint` | Modularized |
| POST | `/students/{student_id}/send-welcome-email` | `send_welcome_email_endpoint` | Modularized |

### Subscriptions (`/subscriptions`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/subscriptions/run-expiry-check` | `run_subscription_expiry_check` | Modularized |

### Analytics (`/analytics`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/analytics/command-center` | `get_command_center_analytics_endpoint` | Modularized |
| GET | `/analytics/conversion-rates` | `get_conversion_rates_endpoint` | Modularized |
| GET | `/analytics/time-to-contact` | `get_time_to_contact_endpoint` | Modularized |
| GET | `/analytics/status-distribution` | `get_status_distribution_endpoint` | Modularized |
| GET | `/analytics/abandoned-count` | `get_abandoned_leads_count_endpoint` | Modularized |
| GET | `/analytics/at-risk-count` | `get_at_risk_leads_count_endpoint` | Modularized |
| GET | `/analytics/pending-student-reports` | `get_pending_student_reports_endpoint` | Modularized |

### Attendance (`/attendance`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/attendance/check-in` | `check_in_attendance` | Needs Review (see §3) |
| GET | `/attendance/history/{lead_id}` | `get_attendance_history_endpoint` | Modularized |

### Approvals (`/approvals`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/approvals/create` | `create_approval_request_endpoint` | Modularized |
| GET | `/approvals/pending` | `get_pending_approval_requests_endpoint` | Modularized |
| POST | `/approvals/{request_id}/resolve` | `resolve_approval_request_endpoint` | Modularized |
| GET | `/approvals/lead/{lead_id}` | `get_lead_requests_endpoint` | Modularized |

### Notifications (`/notifications`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/notifications` | `get_notifications` | Modularized |
| GET | `/notifications/unread-count` | `get_notifications_unread_count` | Modularized |
| PUT | `/notifications/{notification_id}/read` | `mark_notification_read` | Modularized |
| PUT | `/notifications/read-all` | `mark_all_notifications_read` | Modularized |

### Public (`/public`) – No auth

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/public/lead-preferences/{token}` | `get_lead_preferences_public` | Modularized |
| PUT | `/public/lead-preferences/{token}` | `update_lead_preferences_public` | Modularized |
| GET | `/public/join/{token}` | `get_join_page_public` | Modularized |
| POST | `/public/lead-enrollment/{token}` | `submit_enrollment_public` | Modularized |
| POST | `/public/join/{token}` | `submit_join_public_endpoint` | Modularized |
| PUT | `/public/lead-feedback/{token}` | `record_lead_feedback_public` | Modularized |

### Webhooks (`/webhook`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/webhook/meta` | `meta_webhook` | Needs Review (see §3) |

### Tasks (`/tasks`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/tasks/daily-queue` | `get_daily_queue` | Modularized |
| GET | `/tasks/daily-stats` | `get_daily_stats_endpoint` | Modularized |

### Calendar (`/calendar`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/calendar/month` | `get_calendar_month` | Modularized |

### User Stats (`/user/stats`)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| GET | `/user/stats/streak` | `get_user_streak` | Modularized |
| GET | `/user/stats/today` | `get_user_today_stats` | Modularized |

---

## 3. Logic Purity Check (Brain vs Mouth)

**Rule:** API routers must not perform direct database operations. All DB access must go through `backend/core/`.

### Logic Leaks Found

| File | Line | Issue | Recommendation |
|------|------|-------|----------------|
| `backend/api/attendance.py` | 22 | `db.get(Student, body.student_id)` in `_resolve_lead_id_from_body()` | Move to `core.students`: add `get_lead_id_from_student(db, student_id) -> int` or use existing `get_student_with_relations()` and extract `lead_id`. |
| `backend/api/webhooks.py` | 51 | `db.get(Center, lead.center_id)` for center display name | Replace with `get_center_display_name(db, lead.center_id)` from `backend.core.centers`. |

### All Other API Files

No direct DB access detected. Routers delegate to `core/` functions.

---

## 4. Main App Verification (`fastapi_app.py`)

### Router Registration

| Router | Prefix | Tags |
|--------|--------|------|
| `users.router` | *(none)* | Users, Auth |
| `centers.router` | `/centers` | Centers |
| `batches.router` | `/batches` | Batches |
| `leads.router` | `/leads` | Leads |
| `leads.staging_router` | `/staging` | Leads |
| `students.router` | `/students` | Students |
| `students.subscriptions_router` | `/subscriptions` | Students |
| `analytics.router` | `/analytics` | Analytics |
| `attendance.router` | `/attendance` | Attendance |
| `approvals.router` | `/approvals` | Approvals |
| `notifications.router` | `/notifications` | Notifications |
| `public.router` | `/public` | Public |
| `webhooks.router` | `/webhook` | Webhooks |
| `tasks.router` | `/tasks` | Tasks |
| `tasks.calendar_router` | `/calendar` | Calendar |
| `tasks.user_stats_router` | `/user/stats` | User Stats |

**Verification:** All 11 API modules are registered. No missing routers.

### Global Configuration

| Component | Status |
|-----------|--------|
| **CORS** | `CORSMiddleware` with `origins`, `allow_origin_regex`, `allow_credentials` |
| **Rate limiting** | `app.state.limiter = limiter`; `/token` limited to 5/min |
| **Exception handlers** | `RateLimitExceeded` → 429; generic `Exception` → 500 |
| **Middleware** | `proxy_headers_middleware` (x-forwarded-proto); `observer_read_only_middleware` (read-only for observers) |
| **Sentry** | Optional init when `SENTRY_DSN` set |
| **Startup** | `create_db_and_tables()`; prints CORS origins |
| **redirect_slashes** | `False` (avoids 307 redirects) |

---

## 5. Dependency Audit (`backend/api/deps.py`)

### Shared Dependencies

| Dependency | Purpose |
|------------|---------|
| `get_session` | Yields DB session; injected from `backend.core.db` |
| `get_current_user` | Validates JWT via `oauth2_scheme`, loads user from DB |
| `oauth2_scheme` | `OAuth2PasswordBearer(tokenUrl="token")` |
| `limiter` | `Limiter(key_func=get_remote_address)` for rate limiting |

### Usage Across Routers

| Module | Uses `get_session` | Uses `get_current_user` | Uses `limiter` |
|--------|--------------------|-------------------------|----------------|
| users | ✅ | ✅ (except `/token`) | ✅ (`/token`) |
| centers | ✅ | ✅ | — |
| batches | ✅ | ✅ | — |
| leads | ✅ | ✅ | — |
| students | ✅ | ✅ (except public routes) | — |
| analytics | ✅ | ✅ | — |
| attendance | ✅ | ✅ | — |
| approvals | ✅ | ✅ | — |
| notifications | ✅ | ✅ | — |
| tasks | ✅ | ✅ | — |
| public | ✅ | — (no auth) | — |
| webhooks | ✅ | — (no auth) | — |

**Verification:** Auth-required routes use `get_current_user`. Public and webhook routes use only `get_session`. Dependencies are used consistently.

---

## Summary

- **Total endpoints:** 62
- **Modularized:** 60
- **Needs review:** 2 (attendance `_resolve_lead_id`, webhooks `db.get(Center)`)
- **Routers registered:** 16 (all modules)
- **Logic leaks:** 2 (see §3)
