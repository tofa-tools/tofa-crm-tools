# Batch Dropdown Filter – Logic Audit Report

## Goal
Identify every place where **age** is used to filter batches so we can move to **center-only** filtering and fix missing batches in Trial/Demo and Assign Batch dropdowns.

---

## 1. LeadUpdateModal.tsx – Trial/Demo Batch dropdown

### Variable: `trialBatches`
**Location:** Lines 349–351

```ts
const trialBatches = lead && lead.center_id && leadAge != null
  ? filterBatchesByAge(allBatches, leadAge, lead.center_id)
  : [];
```

- **Age used?** Yes. The list is only built when `leadAge != null`.
- **Filter:** `filterBatchesByAge(allBatches, leadAge, lead.center_id)` from `@tofa/core` (see below). So it filters by **center_id** and **age** (min_age / max_age).

### Variable: `studentBatches`
**Location:** Lines 353–355

```ts
const studentBatches = lead && lead.center_id && leadAge != null
  ? filterBatchesByAge(allBatches, leadAge, lead.center_id)
  : [];
```

- Same as `trialBatches`: requires `leadAge != null` and uses `filterBatchesByAge` (center + age).

### Variable: `leadAge`
**Location:** Line 346

```ts
const leadAge = lead?.date_of_birth ? calculateAge(lead.date_of_birth) : null;
```

- If `date_of_birth` is **null/undefined** or invalid, `leadAge` is **null** → `trialBatches` and `studentBatches` are **[]** (empty). So **DOB = NULL or Age 0 does not cause “age 0 filter”**; the real issue is **no DOB → no batches at all** because the condition `leadAge != null` fails.

### Dropdown list building
**Location:** Lines 993–1004 (Trial), 1097+ (Student batches)

- Options come from `trialBatches.map(...)` / `studentBatches.map(...)`.
- So the dropdown list is **not** “only looking at lead.center_id”; it is **center_id + age** (via `filterBatchesByAge`).

### Empty-state message
**Location:** Lines 1006–1013

- When `trialBatches.length === 0`, the UI shows one of:
  - No center: “Assign a center to this lead to see batches.”
  - **No DOB:** “Add date of birth to see eligible batches.”
  - Center + DOB set: “No active batches found for Center: [Center Name].”
- So when DOB is missing, the UI explicitly tells the user that DOB is required for the **current** (age-based) logic.

---

## 2. Core logic – @tofa/core

### File: `packages/core/src/logic/batches.ts`

**Function:** `filterBatchesByAge(batches, age, centerId)`

```ts
export function filterBatchesByAge(
  batches: Batch[],
  age: number,
  centerId: number
): Batch[] {
  return batches.filter(batch => {
    if (batch.center_id !== centerId || !batch.is_active) {
      return false;
    }
    const minAge = batch.min_age ?? 0;
    const maxAge = batch.max_age ?? 99;
    return age >= minAge && age <= maxAge;
  });
}
```

- **Center:** Keeps only batches with `batch.center_id === centerId` and `batch.is_active`.
- **Age:** Keeps only batches where `age >= minAge && age <= maxAge` (min_age/max_age on the batch).
- So **core is still enforcing age restrictions** (min_age / max_age). There is **no** `age_category` in this file; only numeric min/max age.

**Other export in same file:** `getBatchesForDate` – filters by day-of-week and start/end date only; **no age**.

---

## 3. Summary – Every line that uses age as a filter

| Location | What it does |
|----------|----------------|
| **packages/core/src/logic/batches.ts** | `filterBatchesByAge`: filters by `center_id`, `is_active`, and `min_age` / `max_age` (lines 17–23). |
| **apps/web/.../LeadUpdateModal.tsx** | `leadAge = lead?.date_of_birth ? calculateAge(...) : null` (line 346). |
| **apps/web/.../LeadUpdateModal.tsx** | `trialBatches`: only runs when `leadAge != null`, then `filterBatchesByAge(allBatches, leadAge, lead.center_id)` (349–351). |
| **apps/web/.../LeadUpdateModal.tsx** | `studentBatches`: same as above (353–355). |

There is **no** `age_category` or “Age Category” filter in batch dropdown logic; the only age filter is **min_age / max_age** in `filterBatchesByAge` and the requirement that `leadAge != null` in the modal.

---

## 4. DOB / Age 0 effect

- **DOB = NULL:**  
  `leadAge` is **null** → condition `lead && lead.center_id && leadAge != null` is false → `trialBatches` and `studentBatches` are **[]**. So **all batches are hidden** whenever DOB is missing.

- **Age = 0 (valid DOB):**  
  `leadAge === 0` → condition is true, and `filterBatchesByAge(allBatches, 0, center_id)` runs. A batch is shown only if `0 >= min_age && 0 <= max_age`. Defaults are min_age 0, max_age 99, so **age 0 can see batches** that allow 0. If some batches have `min_age > 0`, those are correctly hidden for that lead.

So: **NULL DOB → no batches at all**. Age 0 only hides batches that have `min_age > 0`.

---

## 5. Implemented: center-only filter (global)

1. **Core:** Add a center-only filter (e.g. `filterBatchesByCenter(batches, centerId)`) that only checks `center_id` and `is_active`, and **do not** use age. Optionally keep `filterBatchesByAge` for any other flows that still need age.
2. **LeadUpdateModal:**  
   - For **Trial/Demo** and **Assign Batch** dropdowns, use the new center-only filter.  
   - Require only `lead && lead.center_id` (remove the `leadAge != null` requirement).  
   - Build `trialBatches` and `studentBatches` from `filterBatchesByCenter(allBatches, lead.center_id)`.
3. **Empty-state message:** When `trialBatches.length === 0`, if `lead.center_id` is set, show only: “No active batches found for Center: [Center Name].” Remove the “Add date of birth to see eligible batches” branch so DOB is no longer implied as required for listing batches.

This removes every use of age as a filter for these dropdowns and moves to a **center-only** filter as requested.
