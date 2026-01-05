# TOFA CRM Application - Complete Features Briefing (Updated)

## 📋 Table of Contents
1. [Application Overview](#application-overview)
2. [Authentication & User Management](#authentication--user-management)
3. [Lead Management](#lead-management)
4. [Lead Intelligence & Scoring](#lead-intelligence--scoring)
5. [Center Management](#center-management)
6. [Dashboard & Analytics](#dashboard--analytics)
7. [Import & Data Processing](#import--data-processing)
8. [Data Integrity & Automation](#data-integrity--automation)
9. [Task Management & Calendar](#task-management--calendar)
10. [User Experience Features](#user-experience-features)
11. [Communication Features](#communication-features)
12. [Technical Architecture](#technical-architecture)
13. [API Endpoints Reference](#api-endpoints-reference)

---

## Application Overview

**TOFA CRM** is a comprehensive Customer Relationship Management system built with:
- **Frontend**: Next.js 14 (React), TypeScript, Tailwind CSS, Turbopack
- **Backend**: FastAPI (Python), SQLModel, PostgreSQL/Supabase
- **Authentication**: JWT-based authentication
- **State Management**: React Query, Context API
- **Error Tracking**: Sentry
- **Notifications**: react-hot-toast
- **Development**: Turbopack for faster builds

---

## Authentication & User Management

### 🔐 Authentication Features

**Login System**
- JWT-based authentication with secure token management
- Email/password login form
- Token stored in localStorage with automatic expiration handling
- Protected routes requiring authentication
- Automatic redirect to login for unauthorized access

**User Roles**
- **Team Lead**: Full access to all leads across all centers, bulk operations, user management, batch management
- **Regular User**: Access limited to leads from assigned centers
- **Coach**: Access limited to leads from assigned batches, field-focused features (check-in, attendance)
- **Observer**: Read-only access (future implementation)

**User Management (Team Leads Only)**
- Create new users with email, password, full name, and role
- **Role Selection**: Team Lead, Regular User, Observer, Coach
- **Center Assignment**: Assign users to specific centers (required for coaches)
- **Coach Requirements**: Coaches must be assigned to at least one center
- View all users in the system
- User list with filtering and search capabilities

**API Endpoints:**
- `POST /token` - User login (returns JWT token)
- `POST /users/` - Create new user (team lead only)
- `GET /users/` - List all users (team lead only)

---

## Lead Management

### 📊 Core Lead Operations

**Lead Data Structure**
- Player Name, Age Category, Phone, Email, Address
- Date of Birth (for age calculation)
- Status tracking (New, Called, Trial Scheduled, Trial Attended, Joined, Dead/Not Interested)
- Center assignment (which TOFA center handles the lead)
- Next follow-up date
- Created time and last updated timestamp
- Lead Score (0-5 stars, automatic calculation)
- Metadata (JSONB field for skill reports and extensible data)
- Comments and activity history

**Lead List View**
- **Pagination**: Configurable page sizes (25, 50, 100), default 50
- **Filtering**: 
  - Filter by status (single or multiple statuses)
  - Search by player name (debounced, 300ms delay)
  - Filter by center (for team leads)
  - Filter by next follow-up date
  - Filter by at-risk status (10+ days inactive)
- **Sorting Options**:
  - **Date Created**: Newest leads first (default)
  - **Freshness**: Rotten leads first (leads with oldest `last_updated` appear at top, NULLS LAST)
  - **Score**: Highest scoring leads first (0-5 stars)
- **URL State Persistence**: All filters, search, pagination, and sort preferences saved in URL
- **Select All / Individual Selection**: Checkboxes for bulk operations
- **Freshness Indicators**: Color-coded badges showing time since last contact:
  - 🟢 Green: < 4 hours (Fresh)
  - 🟡 Yellow: 4-24 hours (Needs attention)
  - 🔴 Red: > 24 hours (Rotten, with pulse animation)
- **Lead Score Display**: 5-star rating system displayed in table
- **Abandoned Lead Indicators**: Ghost icon (👻) for leads not touched in > 48 hours

**Lead Detail View**
- Click any lead row to view/edit details
- Update lead status and next follow-up date
- Add comments to leads with @mentions support
- View activity feed (complete history of changes)
- Age Migration Alert (if age category needs updating based on date of birth)
- Skill Report generation (for "Joined" status leads)
- View last skill report with ratings
- All changes automatically logged to audit trail

**Lead Update**
- Status updates with dropdown selection
- Next follow-up date picker
- Comment addition (persists as activity log entry, supports @mentions)
- Age category updates (via migration alert)
- Optimistic UI updates (instant feedback, rollback on error)
- Toast notifications for success/failure
- Automatic score recalculation on update

**Activity Feed**
- Complete chronological history of all lead changes
- Tracks: Status changes, comments added, field updates, mentions
- Shows user who made the change and timestamp
- Visual timeline with icons for different action types
- Automatically updates when new changes are made
- Composite index on `(lead_id, timestamp)` for performance

**Bulk Actions**
- **Select Multiple Leads**: Individual checkboxes or "Select All" checkbox
- **Bulk Status Update**: Change status for all selected leads simultaneously
  - Available to all users
  - Shows count of selected leads
  - Confirmation dialog before execution
  - Toast notification on completion
- **Bulk Center Assignment**: Assign multiple leads to a center at once
  - Team leads only
  - Dropdown to select target center
  - Instant assignment with confirmation
- **Bulk Actions Toolbar**: Floating toolbar appears when leads are selected
  - Clear selection button
  - Status update interface
  - Center assignment interface (team leads)
  - Destructive actions require typing count to confirm

**API Endpoints:**
- `GET /leads/my_leads` - Get paginated leads (with filtering, search, sorting)
  - Query params: `limit`, `offset`, `status`, `search`, `sort_by`, `next_follow_up_date`, `at_risk`, `filter`
- `PUT /leads/{lead_id}` - Update lead status, next date, add comment
- `PUT /leads/{lead_id}/age-category` - Update age category
- `PUT /leads/{lead_id}/metadata` - Update lead metadata (e.g., skill reports)
- `GET /leads/{lead_id}/activity` - Get audit log for a lead
- `POST /leads/bulk/update-status` - Bulk status update
- `POST /leads/bulk/assign-center` - Bulk center assignment

---

## Lead Intelligence & Scoring

### ⭐ Lead Scoring System

**Automatic Scoring (0-5 stars)**
- **+1 point**: Valid email address present
- **+1 point**: Valid phone number (10+ digits)
- **+1 point**: Age category filled
- **+2 points**: High-converting center/source (based on activity)
- **-1 point**: Called 3+ times with no status change
- Score automatically calculated on lead creation and updates
- Displayed as 5-star rating in leads table and detail view
- Color-coded stars: Gold (4-5), Silver (3), Bronze (1-2)
- Sortable by score (highest first)

### 👻 Abandoned Leads Detection

**Ghosting Alerts**
- Identifies leads with status "New" that haven't been touched in > 48 hours
- Visual indicator: Ghost icon (👻) with pulsing animation in leads table
- Tooltip: "Lead not touched in > 48 hours"
- Dashboard metric: "Total Abandoned Leads" card
- Helps identify bottlenecks in lead processing

### ⚠️ At-Risk Members

**Retention Monitoring**
- Identifies leads in "Joined" or "Trial Scheduled" status with no activity in 10+ days
- Dashboard metric: "At-Risk Members" card with red border
- Clickable card redirects to filtered leads view (`/leads?filter=at-risk`)
- Helps identify members who may be losing interest
- Backend logic checks `last_updated` timestamp

### 🔄 Duplicate Detection

**Smart Duplicate Handling**
- Prevents data pollution by detecting duplicate leads
- Checks combination of: Name + Phone + Email
- **If duplicate found**:
  - Does NOT create new record
  - Updates existing lead's `last_updated` timestamp
  - Adds audit log entry: "Duplicate submission detected via [Source]; lead refreshed"
  - Resets status to "New" if previously "Dead/Not Interested"
- Applies to:
  - Bulk CSV/Excel imports
- Source tracking: Records where duplicate was detected (CSV Import)

### 🎂 Age Group Auto-Migration

**Automatic Age Category Calculation**
- Calculates correct age category based on date of birth
- Utility function: `calculateAgeCategory(dob)` returns: U7, U9, U11, U13, U15, U17, Senior
- **Migration Alert**: Shows ArrowUpCircle icon if stored category differs from calculated
- Click icon to confirm migration
- Updates `player_age_category` field in database
- Visible in leads table and lead detail view

### 📊 Skill Reports

**Player Performance Tracking (For Joined Leads)**
- **Generate Report Button**: Visible only when lead status is "Joined"
- **Rating System**: 5-star ratings for:
  - Technical Skill
  - Fitness
  - Teamwork
  - Discipline
- **Coach's Note**: Textarea for additional observations
- **Storage**: Saved in lead's `metadata` JSONB field as `skill_reports` array
- **Last Report Display**: Shows most recent skill report in lead detail view
  - Date of report
  - All ratings with visual stars
  - Coach's note
- **History**: Multiple reports can be stored per lead (array-based)

### 🎁 Smart Referral Trigger

**Referral Request Modal**
- Automatically triggers when lead status changes to "Joined"
- Modal prompt: "Great job! [PlayerName] has joined. Ask the parent for a referral?"
- **WhatsApp Integration**: Generates pre-filled WhatsApp message with:
  - Personalized greeting
  - Referral link: `[website.com]?ref=[LeadID]` for tracking
- **Actions**:
  - "Send Referral Request": Opens WhatsApp with pre-filled message
  - "Skip": Closes modal without action
- Only triggers on status change (not on page load if already "Joined")

---

## Center Management

### 🏢 Center Operations

**Center Features**
- Create new centers with display name, city, and meta tag name
- List all centers in the system
- Center assignment for leads
- Meta tag matching for automated lead imports from Meta Ads

**Center List View**
- Table displaying all centers
- Center details: Display name, city, meta tag
- Add new center functionality (team leads only)

**API Endpoints:**
- `GET /centers/` - List all centers
- `POST /centers/` - Create new center (team lead only)

---

## Batch Management

### 📅 Batch Operations (Training Groups/Sessions)

**Batch Features**
- Create training batches (groups) with name, age category, schedule, and capacity
- Assign multiple coaches to each batch
- Track batch capacity to prevent overbooking
- Seven-day schedule support (Monday through Sunday)
- Time slots (start time and end time)
- Center association (batches belong to centers)
- Age category grouping (U7, U9, U11, U13, U15, U17, Senior)

**Batch List View (Team Leads Only)**
- Table displaying all batches in the system
- Batch details: Name, Center, Age Category, Schedule (days), Capacity, Time slots
- **Coaches Column**: Shows all coaches assigned to each batch
- **Assign Coach Button**: Edit/change coach assignments for existing batches
- Create new batch with coach assignment (required)

**Batch Creation**
- **Required Fields**: Name, Center, Age Category, Schedule (at least one day), Coaches (at least one)
- **Coach Assignment**: Multiple coach selection (checkboxes)
- **Schedule Selection**: Checkboxes for each day of the week (Mon-Sun)
- **Time Configuration**: Optional start time and end time
- **Capacity Management**: Set maximum capacity per batch

**Coach Assignment**
- **Multiple Coaches**: Can assign multiple coaches to a single batch
- **Validation**: At least one coach must be assigned (creation and updates)
- **Replace Assignment**: Updating coach assignments replaces all existing assignments
- **Coach Role Verification**: Only users with "coach" role can be assigned
- **Visual Display**: Coach names displayed as badges in batches table

**API Endpoints:**
- `GET /batches` - List all batches with coaches (team lead only)
  - Query params: `center_id` (optional filter)
  - Returns batches with embedded coach information
- `POST /batches` - Create new batch (team lead only)
  - Query params: `name`, `center_id`, `age_category`, `max_capacity`, schedule booleans, `start_time`, `end_time`, `coach_ids` (comma-separated)
  - Requires at least one coach assignment
- `POST /batches/{batch_id}/assign-coach` - Assign coaches to batch (team lead only)
  - Query params: `coach_ids` (comma-separated list, replaces all existing)
  - Alternative: `user_id` (single assignment, backward compatibility)
- `GET /batches/my-batches` - Get batches assigned to current coach (coaches only)
  - Returns: `{ batches: Batch[], count: number }`

**Batch-Lead Integration**
- Leads can be assigned to `trial_batch_id` and `permanent_batch_id`
- Capacity checking when assigning leads to batches
- Error response: "CAPACITY_REACHED: This batch is full" when capacity exceeded
- Frontend shows specific toast notification for capacity errors

---

## Attendance Management

### ✅ Attendance & Check-In System

**Check-In Page (Coaches Only)**
- **Route**: `/check-in`
- **Mobile-Optimized**: Large touch targets, clean UI, no sidebar on mobile
- **Batch Selection**: Dropdown to select which batch to mark attendance for
- **URL Parameter Support**: `?batchId=X` auto-selects batch from Command Center navigation
- **Student List**: Shows all students (trial and permanent) assigned to selected batch
- **Attendance Actions**: 
  - "Present" button (green) - marks student as present
  - "Absent" button (red) - marks student as absent
- **Search**: Search bar to quickly find students by name
- **Selection Summary**: Shows batch name, age category, time, and student count
- **Complete Session Button**: Prominent button to finish session and return to Command Center
- **Back Navigation**: "Back to Command Center" button at top

**Attendance Recording**
- Records attendance with: lead_id, batch_id, user_id (coach), date, status (Present/Absent), remarks
- **Security**: Verifies coach is assigned to the batch before allowing attendance recording
- **Audit Logging**: Detailed audit log entry: "Coach [Name] marked [PlayerName] as [Status] for [BatchName]"
- **Automatic Updates**: Updates lead status when marked as attended

**Attendance History**
- View attendance history for individual students
- Team leads see all attendance records
- Coaches only see attendance for their assigned batches
- Filtered by lead and date range

**Privacy & Access Control**
- **Coach Privacy**: Coaches cannot see contact information (phone, email, address) - masked as "HIDDEN"
- **Row-Level Filtering**: Coaches only see leads assigned to their batches (trial or permanent)
- **Field-Level Masking**: API automatically masks sensitive fields for coach role
- **Status Restrictions**: Coaches cannot update lead status or sales-related fields
- **View-Only**: Coaches primarily view leads and mark attendance

**API Endpoints:**
- `POST /attendance/check-in` - Record attendance (coaches only)
  - Body: `{ lead_id: int, batch_id: int, status: "Present" | "Absent", remarks?: string }`
  - Verifies coach assignment to batch
  - Returns: `{ status: "recorded", attendance_id: int }`
- `GET /attendance/history/{lead_id}` - Get attendance history for a lead
  - Team leads see all records
  - Coaches see only records for their batches
  - Returns: `{ attendance: Attendance[], count: number }`

---

## Dashboard & Analytics

### 📈 Dashboard Features

**Lead Metrics Cards**
- **Total Leads**: Count of all leads in the system
- **New Leads**: Leads with "New" status (with pending count)
- **Trials Scheduled**: Leads with "Trial Scheduled" status
- **Joined**: Leads that have converted (status: "Joined")
- **Abandoned Leads**: Leads with "New" status, created > 48 hours ago (👻 icon)
- **At-Risk Members**: Leads in "Joined" or "Trial Scheduled" with 10+ days inactivity (⚠️ icon, clickable)

**Operational Intelligence**
- **Average Time to Contact**: Time from lead creation to first contact
  - Color-coded: Green (<1h), Yellow (1-2h), Red (>2h)
  - Warning if > 2 hours: "Above 2 hours - losing money on ads"
- **Conversion Rates**: Key conversion metrics
  - New → Called, Called → Trial Scheduled, Trial Scheduled → Joined
  - Visual progress bars with percentages
  - Color-coded: Green (≥50%), Yellow (≥30%), Red (<30%)

**Visual Charts**
- **Status Distribution Bar Chart**: Visual breakdown of leads by status
- **Recent Leads Table**: Top 5 most recently created leads

**Analytics API Endpoints:**
- `GET /analytics/conversion-rates` - Calculate conversion rates between statuses
- `GET /analytics/time-to-contact` - Average time to first contact
- `GET /analytics/status-distribution` - Distribution of leads by status
- `GET /analytics/abandoned-count` - Count of abandoned leads
- `GET /analytics/at-risk-count` - Count of at-risk members

---

## Import & Data Processing

### 📥 Lead Import Features

**File Upload Support**
- **Formats**: Excel (.xlsx, .xls) and CSV files
- **Encoding**: Automatic detection (UTF-8, Latin-1, CP1252)
- **Validation**: Pre-upload validation to catch errors early

**Dry-Run Preview**
- **Preview Endpoint**: `/leads/upload/preview` validates without saving
- **Validation**: Checks for required columns, valid formats, center matching
- **Error Detection**: Identifies rows with validation errors
- **Summary Statistics**: Shows count of valid vs. invalid rows
- **Column Mapping**: Auto-detection of column mappings
- **Preview Data**: Returns validated data with error messages
- **Error Filter Toggle**: Frontend can filter to show only rows with errors
- **Status**: Backend complete, frontend UI implemented

**Manual Upload**
- Direct file upload for immediate lead import
- Supports Excel and CSV formats
- Automatic center matching via meta tag
- Batch processing of multiple leads
- Duplicate detection and handling

**Column Mapping (Implemented)**
- User-configurable column mapping
- Auto-detection of column names
- Flexible column name matching
- Frontend UI for mapping configuration

**API Endpoints:**
- `POST /leads/upload/preview` - Preview import data (dry-run)
- `POST /leads/upload/` - Final import upload

---

## Task Management & Calendar

### 📅 Planner Pane (Split View)

**Leads Page Integration**
- **Collapsible Side Panel**: Right-hand panel (30% width) alongside leads table (70% width)
- **Toggle Button**: "📅 Planner" button on top-right of table area
- **Smooth Animation**: Tailwind transition for opening/closing
- **State Persistence**: Open/close state saved to localStorage

**Mini-Month Calendar**
- Compact, high-density month view (date-picker style)
- **Heatmap Logic**: Small indicator dots for days with `next_follow_up_date` scheduled
- Clicking a day sets `selectedDate` and filters the leads table
- Bidirectional sync: Calendar click filters table, table filter highlights calendar

**Daily Agenda**
- Scrollable list of leads scheduled for `selectedDate`
- Each lead card shows:
  - Player Name
  - Status (small badge)
  - Most recent comment
- **Quick Action Button**: Opens lead's full update form
- **Overdue Highlighting**: Tasks with `next_follow_up_date` in past (status not "Joined" or "Dead")
- **Today/Overdue Logic**: Visual distinction for overdue items

**Bidirectional Sync**
- Clicking date in Mini-Month updates URL param: `?next_follow_up_date=YYYY-MM-DD`
- Leads table filters to show only leads for that date
- "Clear Filter" button to reset and show all leads

### 📋 Daily Task Queue

**Prioritized Task List**
- **Goal**: Zero friction, work presented in a stack
- **Rollover Logic**: Missed tasks from yesterday prioritized over today's tasks
- **Stack Order**: 
  1. Overdue (oldest first)
  2. Due Today
  3. Upcoming
- **Task Completion Logic**: Task leaves "Today" queue only when action performed:
  - Update Status
  - Add Comment
  - Reschedule
- **Contextual Header**: Daily Vital Stats
  - "You have 12 calls today. 3 are high-priority. Estimated time: 45 mins."
- **Gamification**: 
  - Progress bar
  - "Inbox Zero" celebration
  - Streaks (e.g., "3 days of 100% completion")

**API Endpoints:**
- `GET /tasks/daily-queue` - Get prioritized task list for a date
  - Query params: `target_date` (optional, defaults to today)
  - Returns: `{ overdue: Lead[], due_today: Lead[], upcoming: Lead[] }`
- `GET /tasks/daily-stats` - Get daily statistics
  - Returns: `{ total_tasks, high_priority, estimated_time_minutes, overdue_count, due_today_count }`

### 📆 Full Month Calendar

**Macro-Level Strategy View**
- **Goal**: Planning and workload balancing
- **Heatmap Concept**: Color blocks or intensity dots indicate workload
  - Bright Red: Overloaded days
  - Pale Green: Light workload
- **Visual Priority Toggling**: Filter calendar by Lead Status
  - "Show me only 'Trial Scheduled' dates"
- **Drag-and-Drop Strategy**: (Conceptual) Drag events to reschedule
  - Updates `next_follow_up_date`
- **Sub-Calendar Logic**: Each Center is a "layer" on calendar
  - Team Leads can overlay multiple center schedules
- **Conflict Prevention**: Warnings if center's daily limit reached (e.g., 5 trials)

**API Endpoints:**
- `GET /calendar/month` - Get month view data
  - Query params: `year`, `month`, `center_ids` (optional comma-separated)
  - Returns: `{ "YYYY-MM-DD": { total, high_priority, trials, calls } }`

### 🤖 Operational Automation

**"Idle Lead" Triggers**
- Automatically inserts "Nudge Task" if lead stays in "Called" status for 3 days without update

**"Success Sequence"**
- When lead status changes to "Trial Scheduled", automatically creates two tasks:
  - Reminder: 1 hour before trial
  - Feedback: 24 hours after trial

**"Auto-Cleanup" Logic**
- Voids all future calendar tasks for leads marked "Joined" or "Dead"

---

## Command Center (Role-Aware)

### 🚀 Unified Planning Hub

**Purpose**: Role-specific action hub for sales team and coaches

**Sales Focus (Team Leads & Regular Users)**
- **Metric Cards**:
  - Today's Progress: Leads updated/commented today vs. total due
  - Unscheduled: Leads without next_follow_up_date
  - Overdue: Leads with past due dates
  - Trial Show-Up: Trials marked present today / total scheduled
- **Action Queue**: List of leads requiring action, sorted by priority
- **Quick Actions**: WhatsApp links, status updates, rescheduling

**Coach Focus**
- **Metric Cards**:
  - Session Coverage: Attendance records / total batches scheduled today
  - New Arrivals: Trial Scheduled leads for today in assigned batches
  - Skill Report Backlog: Joined students without recent skill reports (60+ days)
  - Capacity Warning: Batches at >90% capacity
- **Action Queue**: 
  - Batch cards (click navigates to /check-in for that batch)
  - Trial arrivals list
  - Focus on field operations

**Calendar Integration**
- Monthly heatmap showing workload intensity
- Click dates to filter action queue
- Color-coded intensity (grey/green/yellow/red)
- Bidirectional sync with action queue

**Default Landing**: Command Center is default page for coaches after login

**API Endpoints:**
- `GET /analytics/command-center` - Get role-specific analytics
  - Query params: `target_date` (optional)
  - Returns different metrics based on user role

---

## Data Integrity & Automation

### ✅ Data Validation

**Zod Schema Validation**
- **Frontend Forms**: Type-safe form validation using Zod schemas
- **API Responses**: Automatic validation of API responses
- **Type Safety**: Full TypeScript integration
- **Error Prevention**: Catches data mismatches before they cause issues
- **Schemas Defined For**:
  - Lead (LeadSchema, LeadCreateSchema, LeadUpdateSchema)
  - User (UserSchema, UserCreateSchema)
  - AuditLog (AuditLogSchema)
  - API Responses (LeadsResponse, ImportPreviewResponse, etc.)

**Optimistic Updates**
- **Instant UI Feedback**: Changes appear immediately in the UI
- **Rollback on Error**: Automatically reverts if server rejects the change
- **Error Handling**: Shows toast notification on failure
- **React Query Integration**: Seamless optimistic update pattern
- **Implemented In**: Lead status updates, bulk operations

### 🔍 Error Tracking

**Sentry Integration**
- **Client-Side**: Tracks React errors and unhandled exceptions
- **Server-Side**: Captures FastAPI errors and exceptions
- **Edge Runtime**: Instrumentation for edge functions
- **Error Reporting**: Proactive error detection before users report issues
- **Source Maps**: Full stack traces in production
- **Session Replay**: (Optional) User session recording for debugging
- **Configuration**: Environment-based (dev vs. production)
- **Instrumentation Hooks**: Properly configured for Next.js App Router

### 📝 Audit Logging

**Automatic Change Tracking**
- **Every Change Logged**: Status updates, comments, field changes, duplicates
- **User Attribution**: Tracks which user made each change
- **Timestamp**: Precise timing of all changes
- **Change Details**: Stores old and new values
- **Activity Types**:
  - `status_change`: Lead status updates
  - `comment_added`: Comments added to leads
  - `field_update`: Any other field modification
- **AuditLog Table**: Database table storing all activity
- **Composite Index**: `(lead_id, timestamp)` for performance
- **Retrievable**: Full history available via API
- **Batch Actions**: Future support for linking individual changes to batch operations

---

## Communication Features

### 💬 @Mentions System

**Comment Mentions**
- **Syntax**: Type `@username` in comments to mention a user
- **Parsing**: Automatically detects mentions in comment text
- **User Resolution**: Resolves usernames to user IDs
- **Storage**: Stores mentioned user IDs in comment's `mentioned_user_ids` field (JSONB)
- **Notifications**: (Future) Send notifications to mentioned users
- **UI Indicators**: (Future) Highlight mentions in activity feed
- **Integration**: Works in lead comments and activity feed

**API Support**:
- Mentions parsed and stored automatically when comments are added
- Backend validates and resolves usernames to user IDs

---

## User Experience Features

### 🎨 UI/UX Enhancements

**Toast Notifications**
- **Library**: react-hot-toast
- **Success Notifications**: Green toasts for successful operations
- **Error Notifications**: Red toasts with error messages
- **Loading States**: Toast promises for async operations
- **Non-Intrusive**: Appears in corner, auto-dismisses
- **Used For**: Lead updates, bulk operations, form submissions, skill reports

**Sidebar Navigation**
- **Persistent State**: Sidebar collapse state saved in localStorage
- **Toggle Control**: Football icon (⚽) toggles sidebar
- **State Persistence**: Remains collapsed/expanded across page navigation
- **Role-Based Links**:
  - **All Roles**: Dashboard, Command Center, My Leads
  - **Coaches Only**: Check-In (first item)
  - **Team Leads Only**: Batches, Manage Centers, Manage Users, Import Data
- **User Info**: Shows logged-in user email and role
- **Logout**: Logout button with confirmation

**Responsive Design**
- **Mobile-Friendly**: Tailwind CSS responsive utilities
- **Flexible Layouts**: Adapts to different screen sizes
- **Touch-Friendly**: Large touch targets for mobile devices
- **Check-In Page**: Optimized for mobile (no sidebar)

**Loading States**
- **Skeleton Loaders**: Placeholder content while data loads
- **Spinners**: Loading indicators for async operations
- **Disabled States**: Buttons disabled during operations

**Filter Persistence**
- **URL-Based**: All filters stored in URL search params
- **Bookmarkable**: Users can bookmark filtered views
- **Shareable**: Share filtered views via URL
- **Page-Specific**: Each page maintains its own filter state
- **Persists Across**: Navigation, page refreshes, browser back/forward

**Search & Filter UI**
- **Real-Time Search**: Instant filtering as you type (debounced 300ms)
- **Status Filters**: Multi-select checkboxes for status filtering
- **Clear Filters**: Easy reset of all filters
- **Filter Indicators**: Visual feedback of active filters

**Pagination UI**
- **Page Size Selector**: Dropdown to choose items per page (25/50/100)
- **Page Navigation**: Previous/Next buttons, page number display
- **Results Counter**: "Showing X - Y of Z" display
- **Prefetching**: Next page preloaded in background for instant navigation

**Freshness Indicators**
- **Color Coding**: Visual status at a glance
- **Relative Time Display**: Shows "X hours ago" format
- **Absolute Time Tooltips**: Hover to see exact timestamp
- **Pulse Animation**: Red (rotting) indicators have pulsing animation
- **Configurable Thresholds**: Centralized in `config/crm.ts`

**Confirmation Modals**
- **Bulk Actions**: Confirmation dialog before bulk updates
- **Destructive Actions**: Requires typing number of leads to confirm
- **Clear UI**: Simple yes/no confirmation dialogs

---

## Technical Architecture

### 🏗️ Backend Architecture

**Framework**: FastAPI (ASGI)
- Async/await support
- Automatic API documentation (Swagger/OpenAPI)
- Type validation via Pydantic
- Dependency injection system

**Database**: PostgreSQL (via Supabase)
- SQLModel for ORM
- Automatic table creation on startup
- Migrations handled programmatically
- JSONB support for metadata fields
- Composite indexes for performance

**Core Package Structure** (`backend/core/`)
- **Framework-Agnostic**: Business logic separated from web framework
- **Modules**:
  - `auth.py`: JWT encoding/decoding, password hashing
  - `db.py`: Database session management, migrations
  - `users.py`: User CRUD operations, center assignment validation
  - `leads.py`: Lead CRUD operations, filtering, sorting, freshness logic, coach filtering
  - `lead_privacy.py`: Field-level masking for coach role
  - `centers.py`: Center CRUD operations
  - `batches.py`: Batch CRUD operations, coach assignments, capacity checking
  - `attendance.py`: Attendance recording, history retrieval, coach verification
  - `audit.py`: Audit logging functions
  - `bulk_operations.py`: Bulk update operations
  - `import_validation.py`: Import preview and validation
  - `duplicate_detection.py`: Duplicate lead detection and handling
  - `lead_scoring.py`: Lead score calculation logic
  - `abandoned_leads.py`: Abandoned lead detection
  - `at_risk_leads.py`: At-risk member detection
  - `lead_metadata.py`: Metadata management (skill reports)
  - `mentions.py`: @mention parsing and resolution
  - `tasks.py`: Daily task queue logic
  - `auto_tasks.py`: Automated task generation
  - `analytics.py`: Analytics calculations, role-based command center metrics
  - `user_stats.py`: User gamification stats

**Models** (`backend/models.py`)
- SQLModel-based models
- **Core Models**: User, Center, Lead, Comment, AuditLog, Batch, Attendance
- **Join Tables**: UserCenterLink, BatchCoachLink
- **Relationships**: 
  - User ↔ Centers (many-to-many via UserCenterLink)
  - User ↔ Batches (many-to-many via BatchCoachLink, coaches only)
  - Batch ↔ Center (many-to-one)
  - Batch ↔ Leads (one-to-many, trial_batch_id and permanent_batch_id)
  - Lead ↔ Comments, Lead ↔ AuditLogs, Lead ↔ Attendance
- Automatic table generation
- JSONB fields for extensible data (extra_data, mentioned_user_ids)

**Schemas** (`backend/schemas/`)
- Pydantic models for request/response validation
- Separate schemas for different operations (create, update, bulk)

**Error Handling**
- Global exception handler for database connection errors
- Returns 503 Service Unavailable for DB issues
- Detailed error messages in API responses

### 🎨 Frontend Architecture

**Framework**: Next.js 14 (App Router)
- Server Components where appropriate
- Client Components for interactivity
- File-based routing
- Turbopack for faster development builds

**State Management**
- **React Query**: Server state, caching, mutations, optimistic updates
- **Context API**: Authentication state, sidebar state
- **URL Search Params**: Filter/pagination state
- **localStorage**: UI preferences (sidebar state, planner state)

**Type Safety**
- **TypeScript**: Full type coverage
- **Zod**: Runtime validation + TypeScript types
- **Type Inference**: Automatic types from Zod schemas

**Component Structure**
- **Pages**: Route handlers in `app/` directory
- **Components**: Reusable UI components in `components/`
- **Hooks**: Custom React hooks in `hooks/`
- **Lib**: Utilities, API client, configs in `lib/`

**Styling**
- **Tailwind CSS**: Utility-first CSS framework
- **Responsive Design**: Mobile-first approach
- **Consistent Design System**: Reusable components

**API Integration**
- **API Client**: Axios-based client in `lib/api.ts`
- **Request Interceptors**: Automatic token injection
- **Response Validation**: Zod validation of API responses
- **Error Handling**: Centralized error handling

---

## API Endpoints Reference

### Authentication
- `POST /token` - Login (OAuth2PasswordRequestForm) → Returns JWT token

### Users
- `POST /users/` - Create user (team lead only, requires auth)
- `GET /users/` - List all users (team lead only, requires auth)

### Leads
- `GET /leads/my_leads` - Get paginated leads
  - Query params: `limit`, `offset`, `status`, `search`, `sort_by`, `next_follow_up_date`, `at_risk`, `filter`
  - Returns: `{ leads: [], total: int, limit: int, offset: int, sort_by: str }`
- `PUT /leads/{lead_id}` - Update lead
  - Body params: `status`, `next_date` (optional), `comment` (optional), `age_category` (optional)
- `PUT /leads/{lead_id}/age-category` - Update age category
  - Query params: `age_category`
- `PUT /leads/{lead_id}/metadata` - Update lead metadata (e.g., skill reports)
  - Body: `{ skill_reports: [...] }` or other metadata fields
- `GET /leads/{lead_id}/activity` - Get audit logs for lead
  - Query params: `limit` (optional, default 50)
  - Returns: `[{ id, timestamp, user_id, user_name, lead_id, action, details }]`
- `POST /leads/bulk/update-status` - Bulk status update
  - Body: `{ lead_ids: [int], new_status: str }`
  - Returns: `{ updated_count: int, errors: string[] }`
- `POST /leads/bulk/assign-center` - Bulk center assignment (team lead only)
  - Body: `{ lead_ids: [int], center_id: int }`
  - Returns: `{ updated_count: int, errors: string[] }`

### Import
- `POST /leads/upload/preview` - Preview import (dry-run)
  - Form data: `file` (File), `column_mapping` (optional JSON string)
  - Returns: `{ status, total_rows, valid_rows, error_rows, preview_data, required_columns, column_mapping, available_columns }`
- `POST /leads/upload/` - Final import upload
  - Form data: `file` (File), `column_mapping` (optional JSON string)
  - Returns: `{ message: str, imported_count: int }`

### Centers
- `GET /centers/` - List all centers (requires auth)
- `POST /centers/` - Create center (team lead only, requires auth)
  - Body: `{ display_name: str, city: str, meta_tag_name: str }`

### Analytics
- `GET /analytics/conversion-rates` - Calculate conversion rates between statuses
- `GET /analytics/time-to-contact` - Average time to first contact
- `GET /analytics/status-distribution` - Distribution of leads by status
- `GET /analytics/abandoned-count` - Count of abandoned leads
- `GET /analytics/at-risk-count` - Count of at-risk members

### Tasks & Calendar
- `GET /tasks/daily-queue` - Get prioritized task list
  - Query params: `target_date` (optional)
  - Returns: `{ overdue: Lead[], due_today: Lead[], upcoming: Lead[] }`
- `GET /tasks/daily-stats` - Get daily statistics
  - Query params: `target_date` (optional)
  - Returns: `{ total_tasks, high_priority, overdue_count, due_today_count }`
- `GET /calendar/month` - Get month view data
  - Query params: `year`, `month`, `center_ids` (optional)
  - Returns: `{ "YYYY-MM-DD": { total, high_priority, trials, calls } }`

### Batches
- `GET /batches` - List all batches with coaches (team lead only)
  - Query params: `center_id` (optional filter)
  - Returns: Array of batches with embedded coach information
- `POST /batches` - Create new batch (team lead only)
  - Query params: Batch fields + `coach_ids` (comma-separated, required)
  - Returns: `{ status: "created", batch: Batch }`
- `POST /batches/{batch_id}/assign-coach` - Assign coaches to batch (team lead only)
  - Query params: `coach_ids` (comma-separated, replaces all) or `user_id` (single)
  - Returns: `{ status: "assigned", batch_id: int, coach_ids: [int] }`
- `GET /batches/my-batches` - Get batches assigned to current coach (coaches only)
  - Returns: `{ batches: Batch[], count: int }`

### Attendance
- `POST /attendance/check-in` - Record attendance (coaches only)
  - Body: `{ lead_id: int, batch_id: int, status: "Present" | "Absent", remarks?: string }`
  - Returns: `{ status: "recorded", attendance_id: int }`
- `GET /attendance/history/{lead_id}` - Get attendance history
  - Returns: `{ attendance: Attendance[], count: int }`
  - Role-based access (coaches see only their batches)

### Analytics
- `GET /analytics/command-center` - Get role-specific command center analytics
  - Query params: `target_date` (optional)
  - Returns different metrics based on user role (sales vs. coach)

### User Stats (Gamification)
- `GET /user/stats/streak` - Get user streak statistics
- `GET /user/stats/today` - Get today's user statistics

---

## Configuration

### Environment Variables

**Backend** (`.env`):
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `ALGORITHM`: JWT algorithm (default: HS256)

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_SENTRY_DSN`: Sentry DSN for error tracking
- `SENTRY_ORG`: Sentry organization
- `SENTRY_PROJECT`: Sentry project name

### CRM Configuration (`frontend-react/src/lib/config/crm.ts`)
- **Lead Freshness Thresholds**:
  - `GREEN_HOURS`: 4 (Fresh: < 4 hours)
  - `YELLOW_HOURS`: 24 (Needs attention: 4-24 hours)
  - `RED_HOURS`: 24 (Rotten: > 24 hours)
- **Pagination Options**:
  - `DEFAULT_SIZE`: 50
  - `SIZES`: [25, 50, 100]
- **Required Import Columns**: Column mapping definitions

---

## Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: Bcrypt for password storage
- **CORS Protection**: Configured CORS middleware
- **Role-Based Access Control**: Team lead vs. regular user permissions
- **Input Validation**: Pydantic and Zod schema validation
- **SQL Injection Protection**: SQLModel ORM prevents SQL injection
- **Error Sanitization**: Error messages don't leak sensitive info

---

## Performance Optimizations

- **React Query Caching**: Intelligent data caching and refetching
- **Prefetching**: Next page prefetched in background
- **Optimistic Updates**: Instant UI feedback
- **Pagination**: Limits data transfer
- **Database Indexing**: Optimized queries, composite indexes
- **Lazy Loading**: Components loaded on demand
- **Debounced Search**: 300ms delay for search input
- **Turbopack**: Faster development builds

---

## Summary

The TOFA CRM application is a comprehensive, production-ready CRM system with:

✅ **Complete Lead Management**: CRUD operations, filtering, sorting, bulk actions, duplicate detection
✅ **Lead Intelligence**: Scoring, abandoned leads, at-risk monitoring, age migration
✅ **User & Center Management**: Role-based access control with coach role support
✅ **Batch Management**: Training batch creation, multi-coach assignments, capacity tracking
✅ **Attendance System**: Mobile-friendly check-in, attendance tracking, coach verification
✅ **Role-Based Privacy**: Coach-specific data masking and row-level filtering
✅ **Command Center**: Role-aware unified planning hub (sales vs. coach focus)
✅ **Data Integrity**: Validation, audit logging, optimistic updates
✅ **Import System**: File upload, dry-run preview, column mapping
✅ **Analytics Dashboard**: Key metrics, conversion rates, time-to-contact, role-specific analytics
✅ **Task Management**: Daily queue, calendar view, planner pane
✅ **Communication**: @mentions, referral system, skill reports
✅ **Excellent UX**: Toast notifications, URL state persistence, freshness indicators, mobile-friendly
✅ **Production Features**: Error tracking (Sentry), responsive design, type safety, Turbopack

The application is ready for production deployment and provides a solid foundation for future enhancements.

---

## Future Features & Planned Enhancements

### Meta Ads Webhook Integration (Planned)

**Planned Feature**: Automatic lead import from Meta (Facebook/Instagram) ad campaigns.

**Planned Capabilities:**
- **Endpoint**: `/webhook/meta` (to be implemented)
- **Automated Import**: Receive lead data from Meta Ads campaigns in real-time
- **Center Matching**: Automatic center assignment based on meta tag from ad campaign
- **Validation**: Ensure required fields are present
- **Duplicate Detection**: Check for duplicates before creating (will use existing duplicate detection logic)
- **Error Handling**: Graceful handling of invalid or incomplete data
- **Webhook Security**: Verification of webhook signatures from Meta
- **Payload Parsing**: Handle Meta's webhook payload format correctly

**Current Status**: 
- Basic endpoint structure exists in codebase (`/webhook/meta`)
- Core logic for creating leads from meta data exists (`create_lead_from_meta`)
- Full integration with Meta's webhook format and security verification is pending
- Configuration and testing with Meta Business Manager is required

**Implementation Notes:**
- Will require Meta Business Manager setup
- Webhook URL configuration in Meta Ads Manager
- Signature verification for security
- Proper handling of Meta's webhook payload structure
- Integration testing with Meta's sandbox environment
