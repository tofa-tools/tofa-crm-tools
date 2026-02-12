# Notification & Email System — Trigger Audit

This document audits the application for all **trigger points** that should drive a future Notification and Email System (Website, Mobile Push, Email). It identifies events, suggests channels, proposes a Team Lead Feed, and outlines a centralized `NotificationDispatcher`.

---

## 1. Trigger Events (by category)

### 1.1 Sales Alerts

| Event | Description | File:Line | Notes |
|-------|-------------|-----------|--------|
| **New Meta Lead** | Lead created from Meta webhook (ad form) | `fastapi_app.py:623` → `leads.py:674` | After `create_lead_from_meta()` returns |
| **Parent Prefs Received** | Status → "Followed up with message" via public preference form | `public_preferences.py:313-356` | When `preferred_batch_id` set and status in New/Nurture/On Break |
| **Parent Feedback (Not Interested)** | Status → Dead via public feedback form | `public_preferences.py:397` | `record_lead_feedback_by_token()` |
| **Trial No-Show (Reschedule)** | Trial Scheduled lead marked Absent; next_followup → tomorrow 10 AM | `attendance.py:147-174` | `action_type="attendance_reschedule"` |
| **Trial No-Show (2-Strike Dead)** | Trial no-show count ≥ 2 → auto Dead/Not Interested | `attendance.py:176-204` | After `attendance_reschedule` log |
| **Trial Attended** | Trial Scheduled → Trial Attended on Present check-in | `attendance.py:100-145` | Triggers "Hot: Ready to Join" |
| **Lead Joined** | Lead converted to Student (payment confirmed) | `students.py:191-225` | `convert_lead_to_student()` |
| **Re-engagement Nudge Sent** | Nudge sent to Nurture/On Break lead | `leads.py:874` | `increment_nudge_count()` → `nudge_sent` |
| **Nurture 3-Strike Expiry** | Nudge count ≥ 3 → auto Dead, "No response to re-engagement" | `leads.py:811-827` | `check_nudge_expiry()` (called after nudge) |
| **Field Capture Created** | New staging lead (coach or team member) | `staging.py:119` | After `create_staging_lead()` commit |
| **Field Capture Promoted** | Staging → Lead with status Trial Attended | `staging.py:248-262` | After `promote_staging_lead()` |

### 1.2 Operational Alerts

| Event | Description | File:Line | Notes |
|-------|-------------|-----------|--------|
| **Attendance Marked** | Coach marks Present/Absent for a batch date | `attendance.py:206-223` | `action_type="attendance_recorded"` |
| **Milestone Report Created** | Skill report / progress card stored (e.g. 15-session milestone) | `lead_metadata.py` (skill_reports merge) | Via skills endpoint + `update_lead_metadata()` |
| **Report Sent to Parent** | User logs that progress card was shared (e.g. WhatsApp) | `report_audit.py:38` / `fastapi_app.py:1645` | `log_report_sent()` → `REPORT_SENT` |
| **Status Change (any)** | Any lead status change from UI/bulk | `leads.py:387` (single), `bulk_operations.py:47` (bulk) | `log_status_change()` |
| **Comment Added** | Comment added to lead | `leads.py:592` | `log_comment_added()` |
| **Field Update** | DOB, batch, center, loss_reason, etc. | `leads.py` (multiple), `audit.py:96` | `log_field_update()` |
| **Student Re-activated** | On Break → Joined (re-activate) | `leads.py:373` | `action_type='student_reactivated'` |
| **Student Deactivated** | Joined → On Break/Nurture/Dead (soft deactivate) | `leads.py:347` | `action_type='student_deactivated'` |
| **Center Transfer** | Student moved to another center (team_lead or approval) | `students.py:352` / `approvals.py:217` | `center_transfer` / `center_transferred` |
| **Bulk Status Update** | Multiple leads status changed | `bulk_operations.py:42-47` | Per lead `log_status_change` |
| **Bulk Center Assignment** | Multiple leads assigned to new center | `bulk_operations.py:107` | `log_field_update(center_id)` |

### 1.3 Financial Alerts

| Event | Description | File:Line | Notes |
|-------|-------------|-----------|--------|
| **Subscription Entered Grace** | subscription_end_date passed; in_grace_period = True | `subscriptions.py:45-49` | `check_subscription_expirations()` |
| **Subscription Expired (Beyond Grace)** | >4 days past end; lead → On Break, student deactivated | `subscriptions.py:51-79` | Same function |
| **Renewal Intent Recorded** | Parent submitted "Yes" on renewal page | `fastapi_app.py:1119` | `update_renewal_intent_endpoint()` |
| **Grace Nudge Sent** | Staff sent grace period nudge to parent | `fastapi_app.py:1171` (AuditLog) | After incrementing grace_nudge_count |
| **Subscription Updated (Approval)** | SUBSCRIPTION_UPDATE approval applied | `approvals.py:276` | `action_type="subscription_updated"` |

### 1.4 Governance Alerts

| Event | Description | File:Line | Notes |
|-------|-------------|-----------|--------|
| **Approval Requested** | Team member created STATUS_REVERSAL, DEACTIVATE, CENTER_TRANSFER, etc. | `approvals.py:52-66` | `create_request()` |
| **Approval Resolved** | Team lead approved/rejected request | `approvals.py:117-137` | `resolve_request()` |
| **Status Reversal Applied** | STATUS_REVERSAL approved; may delete student | `approvals.py:158-169` | `_apply_status_reversal()` |
| **Deactivate Applied** | DEACTIVATE approved | `approvals.py:196` | `_apply_deactivate()` |
| **Center Transfer Applied** | CENTER_TRANSFER approved | `approvals.py:217` | `_apply_center_transfer()` |
| **Batch Update Applied** | BATCH_UPDATE approved | `approvals.py:238` | `_apply_batch_update()` |
| **Subscription Update Applied** | SUBSCRIPTION_UPDATE approved | `approvals.py:276` | `_apply_subscription_update()` |
| **Student Deleted (Reversal)** | Joined → reverted and student record deleted | `approvals.py:158-161` | `student_deleted` |

---

## 2. Notification Mapping (by audience and channel)

| Event | Parent-Facing | Staff-Facing | Admin/Team Lead |
|-------|----------------|--------------|------------------|
| New Meta Lead | — | In-App/Push (center team) | In-App |
| Parent Prefs Received |In-App/Push (assigned rep) | In-App |
| Parent Feedback (Not Interested) |In-App (rep) | In-App |
| Trial No-Show (Reschedule) | In-App/Push (rep + coach) | In-App |
| Trial No-Show (2-Strike Dead) | — | In-App (rep) | In-App |
| Trial Attended | — | In-App/Push (rep: Hot card) | In-App |
| Lead Joined | Email/WhatsApp welcome | In-App (rep) | In-App |
| Re-engagement Nudge Sent |  In-App (who sent) | — |
| Nurture 3-Strike Expiry | — | In-App (rep) | In-App |
| Field Capture Created | — | In-App/Push (center head / team) | In-App |
| Field Capture Promoted | — | In-App (who promoted) | In-App |
| Attendance Marked | — | In-App (coach confirmation) | — |
| Milestone Report Created | — | In-App (coach) | — |
| Report Sent to Parent | Email/WhatsApp (report link) | In-App (who sent) | — |
| Subscription Grace Started | Email/WhatsApp (renewal CTA) | In-App (center/team) | In-App + Email summary |
| Subscription Expired Beyond Grace | Optional: We’ll miss you | In-App (center) | In-App + Email summary |
| Renewal Intent Recorded | Optional: Confirmation | In-App/Push (center/team) | In-App |
| Grace Nudge Sent | WhatsApp (nudge) | In-App | — |
| Approval Requested | — | In-App/Push (team lead) | In-App (feed) |
| Approval Resolved | — | In-App (requester) | In-App (feed) |
| Center Transfer / Batch / Subscription (Approval) | — | In-App (requester + team lead) | In-App (feed) |

**Channel summary**

- **Parent-facing:** Email + WhatsApp (transactional: prefs confirm, renewal, report link, grace/re-engagement nudges). No push required.
- **Staff-facing:** In-App (bell/feed) + optional Mobile Push for high-priority (new Meta lead, trial attended, approval requested, field capture).
- **Admin/Team Lead:** In-App Global Action Feed (see below) + optional daily/weekly Email summary (approvals, subscriptions, key metrics).

---

## 3. Team Lead Feed (Global Action Feed)

### 3.1 Purpose

A single **Global Action Feed** for the Team Lead to monitor all important actions across centers, users, and action types without opening each lead/student.

### 3.2 Proposed structure

- **Source of truth:** Reuse and extend the existing **AuditLog** table (and optionally ApprovalRequest).
- **Feed API:** New endpoint, e.g. `GET /feed/actions` or `GET /audit/global`, that:
  - Reads from `AuditLog` (and optionally `ApprovalRequest` for created/resolved).
  - Optionally joins Lead → Center, User, so every row has `center_id`, `center_name`, `user_id`, `user_name`, `lead_id`, `action_type`, `description`, `timestamp`.
- **Payload shape (per item):**
  - `id`, `timestamp`, `action_type`, `description`
  - `lead_id`, `player_name`, `center_id`, `center_name`
  - `user_id`, `user_name` (actor)
  - `old_value`, `new_value` (where useful)
  - `approval_request_id`, `request_type`, `status` (if from approvals)

### 3.3 Filters (required for Team Lead)

| Filter | Purpose |
|--------|--------|
| **Center** | Single or multiple; "All" by default for team_lead |
| **User** | Actor (who performed the action) |
| **Action type** | status_change, comment_added, field_update, attendance_recorded, attendance_reschedule, field_capture_promotion, REPORT_SENT, nudge_sent, grace_nudge_sent, student_deactivated, student_reactivated, center_transfer, approval_requested, approval_resolved, etc. |
| **Date range** | From/to date (default: last 7 days) |
| **Lead status** | Optional: filter by current lead status |
| **Request type** (if approval) | STATUS_REVERSAL, DEACTIVATE, CENTER_TRANSFER, BATCH_UPDATE, SUBSCRIPTION_UPDATE, etc. |

### 3.4 Implementation notes

- **AuditLog** already has `lead_id`, `user_id`, `action_type`, `description`, `timestamp`, `old_value`, `new_value`. Add **center_id** either on AuditLog (denormalized) or by joining Lead on `lead_id` so the feed can filter by center.
- **ApprovalRequest** has `request_type`, `status`, `requested_by_id`, `resolved_by_id`, `created_at`, `resolved_at`. Either:
  - Ingest “approval_requested” / “approval_resolved” into AuditLog (recommended for one feed), or
  - Expose a second feed and merge in the API.
- Pagination: cursor or offset on `timestamp` descending.

---

## 4. Technical Implementation: Centralized NotificationDispatcher

### 4.1 Goal

One place to register and dispatch notifications so business logic stays clean and all channels (in-app, push, email, WhatsApp) are consistent and easy to change.

### 4.2 Proposed layout

```
backend/
  core/
    notifications/
      __init__.py
      dispatcher.py    # NotificationDispatcher singleton
      registry.py      # Trigger registry (event_id → channels, templates)
      channels/
        in_app.py      # Write to Notification table or push to feed
        email.py       # Enqueue email (e.g. SendGrid)
        push.py        # FCM / web push
        whatsapp.py    # Optional: WhatsApp Business API or Twilio
```

### 4.3 NotificationDispatcher API (conceptual)

```python
# dispatcher.py
def dispatch(
    event_id: str,           # e.g. "meta_lead_created", "parent_prefs_received"
    context: dict,          # lead_id, center_id, user_id, player_name, etc.
    recipient_roles: list[str] | None = None,  # ["team_lead", "center_staff"]
    exclude_user_id: int | None = None,         # e.g. actor
) -> None:
    # 1. Look up event in registry (channels + template keys)
    # 2. Resolve recipients (by role, center, assignment)
    # 3. For each channel: build payload, enqueue or send
    # 4. Do not raise; log failures
```

- **event_id** maps to a **Trigger Registry** row (see table below).
- **context** provides everything needed for template rendering and recipient resolution (e.g. center_id, lead_id, user_id).
- Recipients can be derived from context (e.g. center’s team_members, assigned rep, team_leads).

### 4.4 Where to call the dispatcher

- **Option A (recommended):** Call `NotificationDispatcher.dispatch(...)` **immediately after** the existing audit log (or in the same place). Keep audit logging as-is; add one line per trigger.
- **Option B:** In a separate layer that subscribes to “audit events” (e.g. event bus or DB triggers). More flexible but more infra.

Example (Option A) after creating a Meta lead:

```python
# fastapi_app.py after create_lead_from_meta()
from backend.core.notifications import dispatch
dispatch("meta_lead_created", {"lead_id": lead.id, "center_id": lead.center_id, "player_name": lead.player_name})
```

### 4.5 In-app and feed

- **In-app:** Either a dedicated `Notification` table (user_id, read_at, title, body, link, created_at) or the Team Lead Feed itself. For staff, “unread” can be derived from feed items with `created_at > user.last_feed_read_at`.
- **Team Lead Feed:** Implemented by querying AuditLog (and optionally ApprovalRequest) with the filters above; no need to duplicate event storage.

---

## 5. Trigger Registry (summary table)

| # | Event ID | Category | File:Line (trigger point) | Recipient (intended) | Recommended channel |
|---|----------|----------|----------------------------|----------------------|----------------------|
| 1 | meta_lead_created | Sales | fastapi_app.py:623 (after create_lead_from_meta) | Center staff, Team lead | Staff: In-App/Push; Admin: In-App |
| 2 | duplicate_lead_refreshed | Sales | duplicate_detection.py:79 (handle_duplicate_lead) | Center staff | Staff: In-App |
| 3 | parent_prefs_received | Sales | public_preferences.py:315 (status update + audit) | Assigned rep, Team lead | Staff: In-App/Push; Parent: Email/WhatsApp (optional) |
| 4 | parent_feedback_not_interested | Sales | public_preferences.py:397 (record_lead_feedback_by_token) | Assigned rep | Staff: In-App |
| 5 | trial_no_show_reschedule | Sales | attendance.py:165 (log_lead_activity attendance_reschedule) | Rep, Coach | Staff: In-App |
| 6 | trial_no_show_2strike_dead | Sales | attendance.py:197 (log_lead_activity status_change) | Rep | Staff: In-App |
| 7 | trial_attended | Sales | attendance.py:138 (log_lead_activity status_change) | Rep | Staff: In-App/Push |
| 8 | lead_joined | Sales | students.py:218 (log_lead_activity after convert) | Rep, Team lead | Staff: In-App; Parent: Email/WhatsApp |
| 9 | nudge_sent | Sales | leads.py:875 (log_lead_activity nudge_sent) | Parent (message), Rep (audit) | Parent: WhatsApp; Staff: In-App |
| 10 | nurture_3strike_expiry | Sales | leads.py:820 (AuditLog in check_nudge_expiry) | Rep | Staff: In-App |
| 11 | field_capture_created | Sales | staging.py:119 (after create_staging_lead commit) | Center head / team | Staff: In-App/Push |
| 12 | field_capture_promoted | Sales | staging.py:253 (log_lead_activity field_capture_promotion) | Promoter, Team lead | Staff: In-App |
| 13 | attendance_recorded | Operational | attendance.py:212 (log_lead_activity attendance_recorded) | Coach (confirmation) | Staff: In-App (optional) |
| 14 | report_sent | Operational | report_audit.py:38 (log_lead_activity REPORT_SENT) | Parent (link), Sender (audit) | Parent: Email/WhatsApp; Staff: In-App |
| 15 | status_change | Operational | leads.py:387, bulk_operations.py:47 | Rep, Team lead (if bulk) | Staff: In-App; Admin: Feed |
| 16 | comment_added | Operational | leads.py:592 | Rep, Team lead | Staff: In-App |
| 17 | student_reactivated | Operational | leads.py:373 | Rep | Staff: In-App |
| 18 | student_deactivated | Operational | leads.py:347, public_preferences.py:410, approvals.py:196 | Rep, Team lead | Staff: In-App; Admin: Feed |
| 19 | center_transfer | Operational | students.py:352, approvals.py:217 | Team lead, Requester | Staff: In-App; Admin: Feed |
| 20 | subscription_grace_started | Financial | subscriptions.py:46 (in_grace_period = True) | Center staff, Parent | Staff: In-App; Parent: Email/WhatsApp |
| 21 | subscription_expired_beyond_grace | Financial | subscriptions.py:56-72 (lead On Break, student deactivated) | Center staff, Team lead | Staff: In-App; Admin: Email summary |
| 22 | renewal_intent_recorded | Financial | fastapi_app.py:1119 (renewal_intent = True) | Center staff | Staff: In-App/Push |
| 23 | grace_nudge_sent | Financial | fastapi_app.py:1171 (AuditLog) | Parent (message) | Parent: WhatsApp |
| 24 | subscription_updated_approval | Financial | approvals.py:276 | Requester, Team lead | Staff: In-App; Admin: Feed |
| 25 | approval_requested | Governance | approvals.py:64 (after create_request commit) | Team lead | Admin: In-App/Push, Feed |
| 26 | approval_resolved | Governance | approvals.py:117 (resolve_request) | Requester, Team lead | Staff: In-App; Admin: Feed |
| 27 | student_deleted_reversal | Governance | approvals.py:158 | Team lead, Requester | Admin: Feed; Staff: In-App |

---

## 6. Next steps

1. **Add center_id to feed queries** (e.g. join Lead on AuditLog.lead_id) so Team Lead can filter by center.
2. **Define `Notification` table** (if in-app bell) and/or **Team Lead Feed API** with filters from §3.3.
3. **Implement NotificationDispatcher** and **Trigger Registry** in code; then add one `dispatch(...)` call at each trigger point in the table.
4. **Implement channels** (in-app first, then email, then push/WhatsApp as needed).
5. **Templates:** For each event_id, add template keys for title, body, and deep link so the dispatcher can resolve them per channel.

This audit and the Trigger Registry table give a single reference for every event, its location in code, intended recipients, and recommended channel for the comprehensive Notification and Email System.
