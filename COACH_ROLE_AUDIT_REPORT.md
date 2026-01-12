# Coach Role Experience Audit Report

## Executive Summary
This audit identifies several critical issues and missing features that need to be addressed to ensure the Coach role is streamlined, secure, and fully functional.

---

## 1. Authentication & Session

### Current State
✅ **Logout Button**: Logout functionality exists in `AuthContext.tsx` (line 46-63), BUT:
- **ISSUE**: Coaches use `BottomNavigation` component, not the `Sidebar` where logout button is located
- Coaches have NO visible logout button in their UI

✅ **Session Persistence**: Batch selection is persisted via URL parameter (`?batchId=`)
- Works on refresh if URL is preserved
- No localStorage/sessionStorage fallback if URL is lost

### Required State
- [ ] Add logout button to `BottomNavigation` component for coaches
- [ ] Consider adding localStorage fallback for batch selection persistence

---

## 2. Sidebar & Navigation

### Current State
✅ **Navigation Structure**: Coaches use `BottomNavigation` component (not Sidebar)
- Home → `/check-in` ✅
- Capture → `/capture` ❌ **BROKEN LINK** (route doesn't exist)
- Reports → `/reports` ❌ **BROKEN LINK** (route doesn't exist)
- Profile → `/profile` ❌ **BROKEN LINK** (route doesn't exist)

✅ **Access Control**: Coaches are correctly excluded from seeing:
- Batches management
- Centers management
- Users management
- Approvals
- Import Data

### Required State
- [ ] Remove or implement `/capture` route (if not needed, remove from navigation)
- [ ] Remove or implement `/reports` route (if not needed, remove from navigation)
- [ ] Remove or implement `/profile` route (if not needed, remove from navigation)

---

## 3. The Check-In Workspace (`/check-in`)

### ✅ Data Integrity - PASSING
- Correctly shows both Trial Leads (status: 'Trial Scheduled') and Active Students
- Properly displays badges: "Active Student" (green) vs "Trial" (blue)
- Grace Period warning badge (⚠️ Payment Pending) correctly displayed

### ✅ Baggage Check - PASSING
- **No photo/capture functionality found** in check-in page
- No legacy upload or image-taking code present
- Clean, focused attendance-marking interface

### ❌ Privacy - CRITICAL ISSUE
**ISSUE**: Student data is NOT masked for coaches

**Evidence**:
- `backend/schemas/students.py`: `StudentRead` schema includes:
  - `lead_phone: Optional[str] = None` (line 25)
  - `lead_email: Optional[str] = None` (line 26)
  - `lead_address: Optional[str] = None` (line 27)
- `backend/fastapi_app.py` (line 741-772): `/students` endpoint returns full `StudentRead` data regardless of user role
- `backend/core/lead_privacy.py`: Only masks `Lead` data, NOT `Student` data
- Check-in page uses `useStudents()` hook which calls `/students` endpoint with full data

**Impact**: Coaches can see parent phone numbers, emails, and addresses for active students, violating privacy requirements.

### Required State
- [ ] Create `mask_student_for_coach()` function in `backend/core/lead_privacy.py`
- [ ] Update `/students` endpoint to mask sensitive fields when `current_user.role === 'coach'`
- [ ] Update `StudentRead.from_student()` to accept a `user_role` parameter
- [ ] Ensure coaches see `None` or `'🔒 Hidden'` for phone, email, address

---

## 4. Missing Integration

### ❌ Attendance History - MISSING
**Current State**: Coach cannot see attendance history on check-in page

**Required State**:
- [ ] Add small attendance indicator on each participant card
  - Show "Last 5 sessions: [dates]" or "Last present: [date]"
  - Or "Sessions attended this month: X"
  - Use `useLeadAttendanceHistory(participant.leadId)` hook

### ❌ Milestones - MISSING
**Current State**: No milestone indicators on check-in list

**Required State**:
- [ ] Fetch milestone data for each student in check-in list
- [ ] Display milestone badge when student is attending a milestone session (10th, 25th, 50th, 100th)
  - Example: "🎉 Today is [PlayerName]'s 10th session!"
- [ ] Use `studentsAPI.getMilestones(studentId)` for each active student

---

## 5. Mobile Ergonomics

### Current State
✅ **Layout**: Mobile-first responsive design
- Uses `flex-col` on mobile, `sm:flex-row` on larger screens
- Sticky bottom navigation with safe area insets
- No wide tables ✅

⚠️ **Button Sizes**:
- Attendance buttons: `py-3` (12px vertical padding) - **Adequate but could be larger**
- Text size: `text-base` (16px) - Good for mobile
- Buttons are `flex-1` which makes them reasonably large

### Required State
- [ ] Consider increasing button padding to `py-4` (16px) for better outdoor usability
- [ ] Ensure minimum touch target of 44x44px (currently ~48px with py-3, so acceptable)
- [ ] Verify button spacing is comfortable for one-handed use

---

## Summary: Current State vs Required State

| Feature | Current State | Required State | Priority |
|---------|--------------|----------------|----------|
| **Logout Button** | ❌ Missing for coaches | ✅ Visible in BottomNavigation | HIGH |
| **Batch Persistence** | ✅ URL parameter only | ✅ URL + localStorage fallback | MEDIUM |
| **Navigation Links** | ❌ 3 broken links (/capture, /reports, /profile) | ✅ All links functional or removed | HIGH |
| **Student Privacy** | ❌ Coaches see phone/email/address | ✅ Masked/hidden for coaches | CRITICAL |
| **Attendance History** | ❌ Not visible | ✅ Show recent attendance on cards | MEDIUM |
| **Milestone Indicators** | ❌ Not visible | ✅ Show milestone badges on check-in | LOW |
| **Mobile Button Size** | ⚠️ py-3 (adequate) | ✅ py-4 (better) | LOW |
| **Photo/Capture Code** | ✅ Clean (no legacy code) | ✅ Maintain clean state | N/A |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Immediate)
1. **Fix Student Privacy**: Implement student data masking for coaches
2. **Fix Broken Navigation**: Remove or implement missing routes
3. **Add Logout**: Add logout button to BottomNavigation

### Phase 2: Enhanced Features (Next Sprint)
4. **Add Attendance History**: Show recent attendance on check-in cards
5. **Add Milestones**: Display milestone indicators for milestone sessions
6. **Improve Persistence**: Add localStorage fallback for batch selection

### Phase 3: Polish (Future)
7. **Optimize Button Sizes**: Increase padding for better outdoor usability
8. **Add Profile Page**: If coaches need profile management

---

## Code Locations for Fixes

### Student Privacy Fix
- File: `backend/schemas/students.py`
- File: `backend/fastapi_app.py` (line 741-772)
- File: `backend/core/lead_privacy.py` (add `mask_student_for_coach` function)

### Navigation Fixes
- File: `frontend-react/src/components/layout/BottomNavigation.tsx` (line 16-19)
- Remove broken links or create route files

### Logout Button
- File: `frontend-react/src/components/layout/BottomNavigation.tsx`
- Add logout button after Profile or replace Profile with Logout

### Attendance History
- File: `frontend-react/src/app/check-in/page.tsx`
- Use `useLeadAttendanceHistory` hook in participant cards

### Milestones
- File: `frontend-react/src/app/check-in/page.tsx`
- Fetch milestones for each student and display badge when applicable

