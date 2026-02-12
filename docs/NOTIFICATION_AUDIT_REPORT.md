# Communication Triggers Audit Report

**Generated:** Backend + Frontend audit of all email triggers and UI notification signals.

---

## 1. Email Triggers (Backend Audit)

Every call to **send_internal_notification** or **send_welcome_email** (including wrappers that use them):

| # | Event | Notification Type | Recipient | Location (file: context) |
|---|--------|-------------------|-----------|---------------------------|
| 1 | **New Lead (Meta)** | Internal email | Center Head group | `fastapi_app.py`: Meta webhook → `send_new_lead_alert_background` (uses `send_internal_notification`) |
| 2 | **New Lead (Manual)** | Internal email | Center Head group | `fastapi_app.py`: POST `/leads` → `send_new_lead_alert_background` |
| 3 | **CSV/Excel Import** | Internal email (summary) | Center Head group(s) | `fastapi_app.py`: POST `/leads/upload` → `send_import_summary_background` (one per center with count > 1) |
| 4 | **Trial Attended** | Internal email | Center Head group | `attendance.py`: `record_attendance` (Present + status → Trial Attended) → `send_internal_notification` |
| 5 | **Preference Response** | Internal email | Center Head group | `public_preferences.py`: `update_lead_preferences_by_token` → `send_internal_notification` (Intent Received) |
| 6 | **Approval Required (Status Reversal)** | Internal email | Admin | `fastapi_app.py`: POST `/approvals/create` when `request_type == STATUS_REVERSAL` → `send_internal_notification` |
| 7 | **Welcome Email (Verify & Enroll)** | Transactional email | Parent (lead email) | `fastapi_app.py`: POST `/leads/{id}/verify-and-enroll` → `send_welcome_email` |
| 8 | **Welcome Email (Manual resend)** | Transactional email | Parent | `fastapi_app.py`: POST `/students/{id}/send-welcome-email` → `send_welcome_email` |
| 9 | **Welcome Email (Public enrollment)** | Transactional email | Parent | `fastapi_app.py`: POST `/public/lead-enrollment/{token}` (enroll with UTR) → `send_welcome_email` |

**Summary**

- **Internal (Center Head):** New Lead (Meta/Manual), CSV Import Summary, Trial Attended, Preference Response.
- **Internal (Admin):** Approval Required (Status Reversal).
- **External (Parent):** Welcome Email (verify-and-enroll, manual resend, public enrollment).

---

## 2. UI Signal Audit (Frontend)

Components that use **pulsing animations** or **warning-style badges** to signal new or attention-needed data:

| Component | Location | Signal Type | When / Meaning |
|-----------|----------|-------------|----------------|
| **ActionGrid – Field Captures card** | `components/planner/ActionGrid.tsx` | `animate-pulse` + `ring-2 ring-brand-accent` | When `staging_leads_count > 0` (new field captures to promote) |
| **MetricCards – Field Captures** | `components/planner/MetricCards.tsx` | `animate-pulse` + ring | When `hasStagingPulse` (staging count > 0) |
| **MetricCards – Ready to Enroll** | `components/planner/MetricCards.tsx` | Green dot `animate-pulse` | Session coverage / New Arrivals (coach view) |
| **MetricCards – New Arrivals** | `components/planner/MetricCards.tsx` | Green dot `animate-pulse` | Trial scheduled today (coach) |
| **BottomNavigation** | `components/layout/BottomNavigation.tsx` | Small dot `animate-pulse` | On “Command Center” and “Tasks” nav items |
| **Check-in page** | `app/check-in/page.tsx` | `animate-pulse` + orange | Row when lead needs attention (e.g. trial status) |
| **Coach players page** | `app/coach/players/page.tsx` | `animate-pulse` + orange | Row for attention-needed state |
| **Tasks page** | `app/tasks/page.tsx` | Gradient `animate-pulse` | Task card styling |
| **FreshnessIndicator** | `components/ui/FreshnessIndicator.tsx` | `animate-pulse` when rotten | Red “rotten” freshness |
| **ExecutiveDashboard** | `components/planner/ExecutiveDashboard.tsx` | Red badge | “Data Health” orphaned data warning |
| **LeadUpdateModal** | `components/leads/LeadUpdateModal.tsx` | Warning banners | “Center Transfer Warning”, “Reversal Request Pending” |
| **Renew / Join pages** | `app/renew/[token]/page.tsx`, `app/join/[token]/page.tsx` | `animate-pulse` on badge | UTR / payment badge |
| **PendingStudentReports** | `components/dashboard/PendingStudentReports.tsx` | `animate-pulse` | Loading skeleton |
| **ExecutiveSidebar / StrategicIntelligence** | `components/planner/` | `animate-pulse` | Loading skeletons |

**Cards that act as “notification” entry points**

- **Backlog Rescue** – Overdue + Reschedule counts.
- **Ready to Enroll (Closing Desk)** – Hot Trials + Renewals.
- **Active Prospects** – New Leads + Pending Trials.
- **Field Captures** – Staging leads (with pulse when > 0).
- **Pending Approvals** (ExecutiveDashboard) – Link to `/approvals` with count.

---

## 3. Component Check: NotificationBell / NotificationCenter

| Item | Status |
|------|--------|
| **NotificationBell** | **Exists.** Implemented in `apps/web/src/components/layout/Sidebar.tsx` (function `NotificationBell`). |
| **Placement** | Rendered in the **Sidebar** user section: (1) when sidebar is expanded (next to user email/role), (2) when sidebar is collapsed (below avatar). |
| **Behavior** | Uses `notificationsAPI.getNotifications`, `notificationsAPI.getUnreadCount`; dropdown with list, “Mark all read”, per-item mark read; unread count badge on bell. |
| **PageHeader** | **Does not** contain a NotificationBell or NotificationCenter. It only has `title`, `subtitle`, and `actions`. |
| **MainLayout** | Uses Sidebar (which includes NotificationBell). All main app pages use MainLayout, so they get the bell via the sidebar. |

**Recommendation**

- **No change required** for global in-app notifications: NotificationBell is already in the Sidebar and visible on all MainLayout pages.
- **Optional:** If you add a **mobile or minimal layout** that hides the sidebar and only shows PageHeader, add a NotificationBell (or link to a notification center) in `PageHeader.tsx` inside the `actions` prop area (e.g. right side next to any existing action buttons). Example:  
  `actions={<><NotificationBell /><OtherActions /></>}`  
  so the bell is available when the sidebar is not.

---

## 4. Event → Notification Type → Recipient (Summary Table)

| Event | Notification Type | Recipient |
|-------|-------------------|-----------|
| New Lead (Meta) | Email (internal) | Center Head group |
| New Lead (Manual) | Email (internal) | Center Head group |
| CSV/Excel Import (multi-lead per center) | Email (internal, summary) | Center Head group(s) |
| Trial Attended | Email (internal) | Center Head group |
| Preference Response (parent submitted preferences) | Email (internal) | Center Head group |
| Approval Required (status reversal) | Email (internal) | Admin |
| Lead verified & enrolled (team lead) | Email (welcome) | Parent |
| Welcome email resend (team lead) | Email (welcome) | Parent |
| Public enrollment (UTR) | Email (welcome) | Parent |

---

*End of audit report.*
