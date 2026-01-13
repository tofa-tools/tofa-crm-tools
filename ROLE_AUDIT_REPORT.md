# User Role System Audit Report
**Generated:** 2024
**Status:** NO CODE CHANGES - Analysis Only

---

## 1. Role Definitions

### Backend (Python/SQLModel)

**File:** `backend/models.py`
- **Line 32-37:** User model definition
- **Role Field:** `role: str = Field(default="regular_user")`
- **Documentation Comment:** `# 'team_lead', 'regular_user', 'coach'`
- **Type:** Plain string (no enum validation at model level)
- **Default Value:** `"regular_user"`

**Note:** Backend does NOT define 'observer' role in the model comment, but accepts any string value.

### Frontend (TypeScript/Zod)

**File:** `frontend-react/src/lib/schemas/user.ts`
- **Line 6:** `UserRoleSchema = z.enum(['team_lead', 'regular_user', 'observer', 'coach'])`
- **Defined Roles:** 
  - `'team_lead'`
  - `'regular_user'`
  - `'observer'` ⚠️ (defined but not implemented)
  - `'coach'`

**File:** `frontend-react/src/lib/constants.ts`
- **Line 9:** `USER_ROLES = ['team_member', 'team_lead', 'observer'] as const`
- **⚠️ INCONSISTENCY:** This file references `'team_member'` instead of `'regular_user'`
- **Status:** This constant appears to be unused or outdated

---

## 2. Usage Map: Role-Based Access Control

### Executive Dashboard Access
**Who can see:** `team_lead` only
- **File:** `frontend-react/src/components/planner/ExecutiveDashboard.tsx`
  - Line 94: `enabled: user?.role === 'team_lead'` (query hook)
  - Line 162: `{user?.role === 'team_lead' && ...}` (conditional render)

### Coach Check-In Access
**Who can see:** `coach` only
- **File:** `frontend-react/src/app/check-in/page.tsx`
  - Line 332: `if (!user || user.role !== 'coach')` (access restriction)
- **File:** `frontend-react/src/components/layout/Sidebar.tsx`
  - Line 20: `{ label: 'Check-In', href: '/check-in', icon: '✅', roles: ['coach'] }`

### Command Center Access
**Who can see:** `team_lead`, `regular_user` (coaches redirected)
- **File:** `frontend-react/src/app/command-center/page.tsx`
  - Line 26: `const isTeamLead = user?.role === 'team_lead'`
  - Line 30-33: Coaches redirected to `/coach/dashboard`
  - Line 35-37: Early return if coach

### Coach Dashboard Access
**Who can see:** `coach` only
- **File:** `frontend-react/src/app/coach/dashboard/page.tsx`
  - Line 115: `if (user?.role !== 'coach')` (redirect)
- **File:** `frontend-react/src/app/coach/players/page.tsx`
  - Line 228: `if (user?.role !== 'coach')` (redirect)

### Team Lead Only Pages
**Who can see:** `team_lead` only

1. **Manage Users** (`frontend-react/src/app/users/page.tsx`)
   - Line 31: `if (user && user.role !== 'team_lead')` (redirect)
   - Line 36: `if (user?.role !== 'team_lead')` (early return)

2. **Manage Centers** (`frontend-react/src/app/centers/page.tsx`)
   - Line 29: `if (user && user.role !== 'team_lead')` (redirect)
   - Line 34: `if (user?.role !== 'team_lead')` (early return)

3. **Manage Batches** (`frontend-react/src/app/batches/page.tsx`)
   - Line 69: `if (user && user.role !== 'team_lead')` (redirect)
   - Line 107: `if (!user || user.role !== 'team_lead')` (early return)
   - Line 269: `if (!user || user.role !== 'team_lead')` (early return)
   - Multiple UI conditionals: Lines 290, 370, 375, 392, 393, 395, 426

4. **Approvals** (`frontend-react/src/app/approvals/page.tsx`)
   - Line 31: `if (user && user.role !== 'team_lead')` (redirect)
   - Line 40: `enabled: user?.role === 'team_lead'` (query hook)
   - Line 70: `if (!user || user.role !== 'team_lead')` (early return)

5. **Import Data** (`frontend-react/src/app/import/page.tsx`)
   - Line 30: `if (user && user.role !== 'team_lead')` (redirect)
   - Line 35: `if (user?.role !== 'team_lead')` (early return)

### Sales Access (team_lead OR regular_user)
**Who can see:** `team_lead`, `regular_user`

1. **Action Queue** (`frontend-react/src/components/planner/ActionQueue.tsx`)
   - Line 38: `const isSales = user?.role === 'team_lead' || user?.role === 'regular_user'`

2. **Leads Page** (`frontend-react/src/app/leads/page.tsx`)
   - Line 101: `enabled: user?.role === 'team_lead' || user?.role === 'regular_user'` (query hook)
   - Line 287: Staging leads visible to sales roles
   - Line 407: Phone numbers hidden from coaches

3. **Metric Cards** (`frontend-react/src/components/planner/MetricCards.tsx`)
   - Line 42: `const isSales = user?.role === 'team_lead' || user?.role === 'regular_user' || user?.role === 'team_member'`
   - ⚠️ **NOTE:** Also checks for `'team_member'` (inconsistent with other files)

### Backend API Endpoints - Role Checks

**File:** `backend/fastapi_app.py`

#### Team Lead Only Endpoints:
- Line 173: Create Center
- Line 204: Update Center
- Line 229: Delete Center
- Line 274: Create User
- Line 295: Update User
- Line 324: Delete User
- Line 383: Bulk Update Status
- Line 679: Get All Users (masked for non-team-leads)
- Line 808: Get All Centers
- Line 950: Get All Batches
- Line 1039: Create Batch
- Line 1160: Update Batch
- Line 1210: Delete Batch
- Line 1318: Run Expiry Check
- Line 1930: Assign Coach to Batch
- Line 1997: Assign Coach to Batch (POST)

#### Coach Only Endpoints:
- Line 1074-1116: Update Lead Metadata (coaches can only update skill_reports)
- Line 1450: Create Skill Evaluation
- Line 1517: Create Staging Lead

#### Sales Roles (team_lead OR regular_user):
- Line 1555: Get Daily Task Queue
- Line 1579: Get Calendar Month View
- Line 1869: Get All Leads (with privacy filtering)

#### Coach-Specific Logic:
- Line 528: Mask sensitive fields for coaches in lead responses
- Line 771: Mask student data for coaches
- Line 1279-1298: Coach milestone access (only for students in their batches)
- Line 1488: Coach skill evaluation access (only for leads in their batches)
- Line 1677: Coach attendance access (only for their batches)

---

## 3. Role Dropdown Definition

**File:** `frontend-react/src/app/users/page.tsx`
**Lines:** 215-223

```tsx
<select
  value={role}
  onChange={(e) => setRole(e.target.value)}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
>
  <option value="team_lead">Team Lead</option>
  <option value="regular_user">Regular User</option>
  <option value="observer">Observer</option>
  <option value="coach">Coach</option>
</select>
```

**Note:** The dropdown includes `'observer'` as an option, but this role is not fully implemented in the system.

---

## 4. Gap Analysis: Renaming 'regular_user' to 'team_member'

### What Would Break:

#### Backend (Python):
1. **`backend/core/analytics.py`**
   - Line 257: `if user.role in ["team_lead", "regular_user"]:`
   - Line 1102: `select(User).where(User.role.in_(["team_lead", "regular_user"]))`

2. **`backend/fastapi_app.py`**
   - Line 1555: `if current_user.role not in ["team_lead", "regular_user"]:`
   - Line 1579: `if current_user.role not in ["team_lead", "regular_user"]:`
   - Line 1869: `if current_user.role not in ["team_lead", "regular_user"]:`

#### Frontend (TypeScript/React):
1. **`frontend-react/src/lib/schemas/user.ts`**
   - Line 6: `z.enum(['team_lead', 'regular_user', 'observer', 'coach'])` - Would need schema update

2. **`frontend-react/src/components/planner/ActionQueue.tsx`**
   - Line 38: `user?.role === 'regular_user'`

3. **`frontend-react/src/app/leads/page.tsx`**
   - Line 101: `user?.role === 'regular_user'`
   - Line 287: `user?.role === 'regular_user'`

4. **`frontend-react/src/components/planner/MetricCards.tsx`**
   - Line 42: `user?.role === 'regular_user'` (also has `'team_member'` check - inconsistent)

5. **`frontend-react/src/app/users/page.tsx`**
   - Line 25: `const [role, setRole] = useState('regular_user');`
   - Line 45: `setRole('regular_user');`
   - Line 219: `<option value="regular_user">Regular User</option>`

### Migration Impact:
- **Total Files Affected:** 8 files
- **Backend:** 3 files
- **Frontend:** 5 files
- **Database:** Would need migration script to update existing user records
- **Risk Level:** Medium (affects access control logic)

---

## 5. Observer Role Analysis

### Current Status:
- ✅ **Defined in Frontend Schema:** `frontend-react/src/lib/schemas/user.ts` includes `'observer'` in enum
- ✅ **Available in Dropdown:** `frontend-react/src/app/users/page.tsx` has observer option
- ❌ **No Implementation Found:** No role checks for `'observer'` anywhere in codebase
- ❌ **No Backend Support:** Backend model comment doesn't mention observer

### Where Read-Only Logic Would Need to Be Added:

#### Frontend Components (Disable Buttons/Forms):

1. **Lead Management** (`frontend-react/src/components/leads/LeadUpdateModal.tsx`)
   - Line 1573: Status update button - should be `disabled={user?.role === 'observer'}`
   - Line 1575: Center transfer - should be disabled for observers
   - Line 625: Reversal form - should be hidden for observers
   - Line 959, 1175: Reversal form conditionals

2. **Bulk Actions** (`frontend-react/src/components/leads/BulkActionsToolbar.tsx`)
   - All bulk action buttons should be disabled for observers

3. **Action Queue** (`frontend-react/src/components/planner/ActionQueue.tsx`)
   - Task completion buttons should be disabled
   - Status update buttons should be disabled

4. **Leads Page** (`frontend-react/src/app/leads/page.tsx`)
   - Bulk selection checkboxes should be disabled
   - Action buttons should be disabled

5. **Batches Page** (`frontend-react/src/app/batches/page.tsx`)
   - Create/Edit/Delete buttons should be disabled
   - Coach assignment should be disabled

6. **Users Page** (`frontend-react/src/app/users/page.tsx`)
   - Create/Edit/Delete buttons should be disabled

7. **Centers Page** (`frontend-react/src/app/centers/page.tsx`)
   - Create/Edit/Delete buttons should be disabled

8. **Command Center** (`frontend-react/src/app/command-center/page.tsx`)
   - Metric card click actions should be disabled
   - Action queue interactions should be disabled

#### Backend API Endpoints (Add Read-Only Checks):

1. **All POST/PUT/DELETE endpoints in `backend/fastapi_app.py`**
   - Add check: `if current_user.role == "observer": raise HTTPException(403, "Observers have read-only access")`
   - Affected endpoints:
     - Create/Update/Delete Lead (Lines ~500-600)
     - Create/Update/Delete Center (Lines 173, 204, 229)
     - Create/Update/Delete User (Lines 274, 295, 324)
     - Create/Update/Delete Batch (Lines 1039, 1160, 1210)
     - Bulk Updates (Line 383)
     - Record Attendance (Line 1606)
     - Create Skill Evaluation (Line 1450)
     - Update Lead Metadata (Line 1074)
     - All other mutation endpoints

2. **Query Endpoints:**
   - Should remain accessible (read-only)
   - May need to add observer-specific filtering (e.g., only see leads in their assigned centers)

#### Navigation/Sidebar:
- **File:** `frontend-react/src/components/layout/Sidebar.tsx`
  - Observer should see all pages but with read-only UI
  - No changes needed to navigation filtering

#### Estimated Implementation Effort:
- **Frontend:** ~15-20 components need observer checks
- **Backend:** ~30+ endpoints need observer guards
- **Testing:** All role-based flows need observer test cases

---

## 6. Summary & Recommendations

### Key Findings:

1. **Inconsistency:** `constants.ts` references `'team_member'` but system uses `'regular_user'`
2. **Observer Role:** Defined in frontend but not implemented anywhere
3. **No Enum Validation:** Backend accepts any string for role (no strict validation)
4. **Widespread Usage:** Role checks appear in 60+ locations across codebase

### Recommendations:

1. **Standardize Role Names:**
   - Decide on `'regular_user'` vs `'team_member'` and update all references
   - Remove or update `constants.ts` to match actual usage

2. **Backend Validation:**
   - Add enum validation at the API level (Pydantic schema)
   - Consider database-level constraint if using PostgreSQL ENUM

3. **Observer Role Implementation:**
   - If implementing, create a comprehensive plan for read-only access
   - Consider using a role hierarchy/permission system instead of hardcoded checks

4. **Code Organization:**
   - Consider extracting role checks into utility functions
   - Create a centralized role/permission configuration file

---

**End of Report**

