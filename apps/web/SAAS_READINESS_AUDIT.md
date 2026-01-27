# SaaS Readiness Audit Report
**Date:** Generated automatically  
**Scope:** Complete codebase scan for white-label readiness

---

## Executive Summary

The application has **partial SaaS readiness** with several areas requiring standardization for white-label deployment. Key findings:

- ✅ **Brand tokens defined** but not fully utilized
- ⚠️ **Hardcoded colors** found in 50+ locations
- ⚠️ **Hardcoded "TOFA" branding** found in 19 locations
- ⚠️ **PageHeader component** missing from 11 pages
- ⚠️ **Font consistency** - Bebas Neue not applied to all headings
- ❌ **CSS Variables** - Tailwind config uses hardcoded hex codes (not CSS variables)

---

## 1. Hardcoded Visuals

### 1.1 Hardcoded Colors (Not Using Brand Tokens)

#### Critical Issues - Direct Color Usage:
**Location:** `apps/web/src/app/leads/page.tsx`
- Line 255, 268: `bg-indigo-600` (should use `bg-brand-primary` or gold gradient)
- Line 295: `text-indigo-100` (should use `text-brand-accent/10`)
- Line 298: `text-indigo-700` (should use `text-brand-primary`)
- Line 317: `focus:ring-indigo-500` (should use `focus:ring-brand-accent`)
- Line 399: `hover:bg-indigo-50/30` (should use `hover:bg-brand-accent/10`)
- Line 405: `text-indigo-600` (should use `text-brand-accent`)

**Location:** `apps/web/src/app/users/page.tsx`
- Line 198: `bg-blue-100 text-blue-800` (should use brand tokens)
- Line 327: `text-indigo-600 focus:ring-indigo-500` (should use brand tokens)
- Line 464: `text-indigo-600 hover:bg-indigo-50` (should use brand tokens)

**Location:** `apps/web/src/app/import/page.tsx`
- Line 140: `bg-blue-50 border-blue-200 text-blue-700` (should use brand tokens)
- Line 157: `file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100` (should use brand tokens)
- Line 160: `text-green-600` (should use brand tokens)

**Location:** `apps/web/src/app/page.tsx` (Root)
- Line 29: `border-indigo-600` (should use `border-brand-accent`)

**Location:** `apps/web/src/components/leads/LeadUpdateModal.tsx`
- Multiple instances: `bg-indigo-50`, `bg-blue-50`, `bg-purple-50`, `bg-blue-600`, `text-indigo-700`, `text-blue-600`, `text-purple-600` (50+ instances)
- Should be replaced with brand tokens or semantic color classes

**Location:** `apps/web/src/app/batches/page.tsx`
- Line 400, 663, 994: `peer-checked:bg-indigo-600` (toggle switches)
- Line 397, 660, 991: `peer-focus:ring-indigo-300` (focus rings)

### 1.2 Hardcoded "TOFA" Branding Strings

**Total Found:** 19 instances across codebase

#### Critical Locations:

**Location:** `apps/web/src/app/layout.tsx`
- Line 14: `title: 'TOFA Academy CRM'` → Should use config variable
- Line 15: `description: 'CRM system for TOFA Academy'` → Should use config variable

**Location:** `apps/web/src/components/leads/LeadUpdateModal.tsx`
- Line 353: `"Hey! We are following up on your interest for ${lead.player_name} to join TOFA Academy"` → Should use `{academyName}` variable

**Location:** `apps/web/src/components/planner/ActionQueue.tsx`
- Line 326: `"Hi! This is regarding ${playerName}'s enrollment at TOFA Academy."` → Should use `{academyName}` variable

**Location:** `apps/web/src/components/planner/QuickUpdateModal.tsx`
- Line 47: `"Hello! I wanted to follow up on ${lead.player_name}'s interest in joining TOFA Academy."` → Should use `{academyName}` variable

**Location:** `apps/web/src/components/planner/DailyAgenda.tsx`
- Line 83: `"Hi! This is regarding ${playerName}'s enrollment at TOFA Academy."` → Should use `{academyName}` variable

**Location:** `apps/web/src/components/leads/PlayerSuccessCard.tsx`
- Line 222: `"TOFA ACADEMY"` → Should use `{academyName}` variable
- Line 231: `{centerName || 'TOFA Academy'}` → Should use `{academyName}` variable

**Location:** `apps/web/src/components/reports/PlayerReportGenerator.tsx`
- Line 83: `"TOFA Academy Progress Report"` → Should use `{academyName}` variable
- Line 86: `<!-- TOFA Logo -->` → Should use dynamic logo

**Location:** `apps/web/src/components/reports/PlayerReportCard.tsx`
- Line 99: `"TOFA Academy Progress Report"` → Should use `{academyName}` variable
- Line 104: `{/* TOFA Logo Placeholder */}` → Should use dynamic logo

**Location:** `apps/web/src/app/feedback/[token]/page.tsx`
- Line 59: `center_name: 'TOFA Academy'` → Should use config variable

**Location:** Logo alt text (multiple files):
- `apps/web/src/components/layout/Sidebar.tsx` (Lines 94, 120)
- `apps/web/src/app/command-center/page.tsx` (Line 117)
- `apps/web/src/components/forms/LoginForm.tsx` (Line 56)
- `apps/web/src/app/check-in/page.tsx` (Line 365)
- `apps/web/src/app/coach/players/page.tsx` (Line 257)

---

## 2. Component Coverage

### 2.1 PageHeader Usage Status

#### ✅ Pages Using PageHeader:
1. `/import` - ✅ Uses PageHeader
2. `/leads` - ✅ Uses PageHeader
3. `/users` - ✅ Uses PageHeader
4. `/approvals` - ✅ Uses PageHeader
5. `/batches` - ✅ Uses PageHeader
6. `/centers` - ✅ Uses PageHeader
7. `/coach/dashboard` - ✅ Uses PageHeader

#### ❌ Pages Missing PageHeader:
1. `/command-center` - ❌ Custom header (Line 124: `<h1 className="text-3xl font-black text-white uppercase tracking-tight">Command Center</h1>`)
2. `/tasks` - ❌ Custom header (Line 93: `<h1 className="text-3xl font-bold text-gray-900">📋 Daily Task Queue</h1>`)
3. `/planner` - ❌ Custom header (Line 88: `<h1 className="text-3xl font-bold text-gray-900">📅 Unified Planner</h1>`)
4. `/calendar` - ❌ No header found
5. `/check-in` - ❌ No header found
6. `/login` - ❌ Uses LoginForm component (separate design)
7. `/page.tsx` (Root) - ❌ Redirect page (no header needed)
8. `/pref/[token]` - ❌ Public page (no header)
9. `/renew/[token]` - ❌ Public page (no header)
10. `/feedback/[token]` - ❌ Public page (no header)
11. `/coach/players` - ❌ No header found

### 2.2 Card Component Standardization

**Standard Card Style:** `bg-white rounded-2xl shadow-xl`

#### Pages Using Standardized Cards:
- ✅ `/centers` - Uses `rounded-2xl shadow-xl`
- ✅ `/users` - Uses `rounded-2xl shadow-xl`
- ✅ `/approvals` - Uses `rounded-2xl shadow-xl`
- ✅ `/batches` - Uses `rounded-2xl shadow-xl`

#### Pages with Non-Standard Cards:
- ⚠️ `/command-center` - Uses various card styles
- ⚠️ `/tasks` - Uses various card styles
- ⚠️ `/planner` - Uses various card styles
- ⚠️ `/calendar` - Uses various card styles
- ⚠️ `/check-in` - Uses various card styles

---

## 3. Font Consistency

### 3.1 Bebas Neue Font Usage

**Font Variable:** `font-bebas` (defined in `tailwind.config.ts`)

#### ✅ Pages Using font-bebas:
- `/import` - Line 149, 213: Uses `font-bebas`
- `/users` - Line 228: Uses `font-bebas`
- `/centers` - Line 142, 240: Uses `font-bebas`

#### ❌ Pages Missing font-bebas:
1. `/command-center` - Line 124: Uses default font
2. `/tasks` - Line 93: Uses default font
3. `/planner` - Line 88: Uses default font
4. `/calendar` - No headings found
5. `/check-in` - No headings found
6. `/leads` - Headings use default font (should use `font-bebas`)
7. `/approvals` - Headings use default font (should use `font-bebas`)
8. `/batches` - Headings use default font (should use `font-bebas`)
9. `/coach/dashboard` - Uses default font
10. `/coach/players` - Uses default font

**Note:** `PageHeader` component (Line 16) uses default font. Should add `font-bebas` class.

---

## 4. Theme Portability (CSS Variables)

### 4.1 Current State

**Location:** `apps/web/tailwind.config.ts`

**Issue:** ❌ Uses hardcoded hex codes instead of CSS variables

```typescript
// CURRENT (Not SaaS-ready):
brand: {
  primary: '#0A192F', // Hardcoded hex
  accent: '#D4AF37',  // Hardcoded hex
  surface: '#F8FAFC', // Hardcoded hex
},
'tofa-gold': {
  DEFAULT: '#D4AF37', // Hardcoded hex
  // ...
},
'tofa-navy': {
  DEFAULT: '#0A192F', // Hardcoded hex
  // ...
}
```

**Required:** Should use CSS variables for white-label support:

```typescript
// REQUIRED (SaaS-ready):
brand: {
  primary: 'var(--brand-primary)',
  accent: 'var(--brand-accent)',
  surface: 'var(--brand-surface)',
},
'tofa-gold': {
  DEFAULT: 'var(--color-gold)',
  // ...
},
'tofa-navy': {
  DEFAULT: 'var(--color-navy)',
  // ...
}
```

**Impact:** Currently, changing brand colors requires editing TypeScript config. For SaaS, should be changeable via CSS file only.

---

## 5. Gap Report Summary

### Priority 1: Critical (Blocks White-Label)
1. ❌ **CSS Variables** - Tailwind config must use CSS variables
2. ❌ **Hardcoded "TOFA" strings** - 19 instances need config variables
3. ❌ **Hardcoded colors** - 50+ instances need brand token replacement

### Priority 2: High (Affects Consistency)
4. ⚠️ **PageHeader missing** - 11 pages need standardization
5. ⚠️ **Font consistency** - 10+ pages missing `font-bebas`
6. ⚠️ **Card standardization** - 5+ pages need card style updates

### Priority 3: Medium (Polish)
7. ⚠️ **Component color usage** - LeadUpdateModal has 50+ hardcoded colors
8. ⚠️ **Public pages** - `/pref`, `/renew`, `/feedback` need brand token review

---

## 6. Recommended Actions

### Immediate (SaaS Blockers):
1. **Create config file** (`src/lib/config/brand.ts`):
   ```typescript
   export const BRAND_CONFIG = {
     academyName: process.env.NEXT_PUBLIC_ACADEMY_NAME || 'TOFA Academy',
     logoPath: process.env.NEXT_PUBLIC_LOGO_PATH || '/logo.png',
   };
   ```

2. **Update tailwind.config.ts** to use CSS variables:
   ```typescript
   brand: {
     primary: 'var(--brand-primary, #0A192F)',
     accent: 'var(--brand-accent, #D4AF37)',
     surface: 'var(--brand-surface, #F8FAFC)',
   }
   ```

3. **Create CSS variables file** (`src/app/globals.css`):
   ```css
   :root {
     --brand-primary: #0A192F;
     --brand-accent: #D4AF37;
     --brand-surface: #F8FAFC;
   }
   ```

4. **Replace all "TOFA" strings** with `BRAND_CONFIG.academyName`

5. **Replace hardcoded colors** with brand tokens (`bg-brand-primary`, `text-brand-accent`, etc.)

### Short-term (Consistency):
6. **Add PageHeader** to `/command-center`, `/tasks`, `/planner`, `/calendar`, `/check-in`
7. **Add font-bebas** to all headings and PageHeader component
8. **Standardize cards** across all pages

### Long-term (Polish):
9. **Refactor LeadUpdateModal** to use brand tokens
10. **Review public pages** for brand consistency
11. **Create theme switcher** for multi-tenant support

---

## 7. Files Requiring Updates

### Critical Files:
- `apps/web/tailwind.config.ts` - CSS variables
- `apps/web/src/app/layout.tsx` - Remove "TOFA" strings
- `apps/web/src/lib/config/brand.ts` - **CREATE NEW** config file
- `apps/web/src/app/globals.css` - **ADD** CSS variables

### High Priority Files:
- `apps/web/src/components/leads/LeadUpdateModal.tsx` - 50+ color replacements
- `apps/web/src/app/leads/page.tsx` - Color replacements
- `apps/web/src/app/users/page.tsx` - Color replacements
- `apps/web/src/app/import/page.tsx` - Color replacements
- `apps/web/src/components/planner/ActionQueue.tsx` - "TOFA" string replacement
- `apps/web/src/components/planner/QuickUpdateModal.tsx` - "TOFA" string replacement
- `apps/web/src/components/planner/DailyAgenda.tsx` - "TOFA" string replacement
- `apps/web/src/components/leads/PlayerSuccessCard.tsx` - "TOFA" string replacement
- `apps/web/src/components/reports/PlayerReportGenerator.tsx` - "TOFA" string replacement
- `apps/web/src/components/reports/PlayerReportCard.tsx` - "TOFA" string replacement

### Medium Priority Files:
- `apps/web/src/app/command-center/page.tsx` - Add PageHeader, font-bebas
- `apps/web/src/app/tasks/page.tsx` - Add PageHeader, font-bebas
- `apps/web/src/app/planner/page.tsx` - Add PageHeader, font-bebas
- `apps/web/src/components/ui/PageHeader.tsx` - Add font-bebas
- `apps/web/src/app/calendar/page.tsx` - Add PageHeader
- `apps/web/src/app/check-in/page.tsx` - Add PageHeader
- `apps/web/src/app/coach/players/page.tsx` - Add PageHeader

---

**End of Audit Report**

