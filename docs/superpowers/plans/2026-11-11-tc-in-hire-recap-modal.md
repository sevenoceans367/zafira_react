# TC In Hire Recap Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-step TC Hire Details modal with the full Add/Edit TC In Hire Recap form popup, persist the full snapshot as `TC_IN_RECAP_JSON`, and keep parent Final TC In Hireage on slave2–4.

**Architecture:** New `TcInHireRecapModal` + `tcInRecapCalcs.js`; expand `tcInExpenses` shape; ensure/save/load `TC_IN_RECAP_JSON` on `chartering_estimate_tc_master`; continue writing hire/bunker/off-hire to slave2–4.

**Tech Stack:** React (Vite), CSS modules, Express/MySQL (`tcEstimateDb.js`).

## Global Constraints

- Parent Total Expenses still uses Final TC In Hireage (not Gross Hire).
- No new slave tables for Pre-TC / TC Expenses / voyage / docs.
- Redelivery bunker qty mirrors Delivery; only price editable.
- Period extension UI allowed; calcs use Period 1 only.

---

## File map

| File | Role |
| --- | --- |
| `frontend/.../tc/tcInRecapCalcs.js` | Final Hireage + Gross Hire + empties + prefill |
| `frontend/.../tc/TcInHireRecapModal.jsx` | Full form modal |
| `frontend/.../tc/TcPages.module.css` | Modal layout styles |
| `frontend/.../tc/TcFixtureFormPage.jsx` | Wire new modal; send JSON on save |
| `frontend/.../tc/TcInExpensesModal.jsx` | Re-export calcs/empties for compat; deprecate UI |
| `backend/.../tcEstimateDb.js` | ensure column; save/load JSON |
| `backend/sql/alter_tc_master_tc_in_recap_json.sql` | Guarded ALTER |

---

### Task 1: Calcs + empties

- [ ] Create `tcInRecapCalcs.js` with existing Final Hireage logic, Gross Hire calc, EMPTY_* , `buildTcInRecapDraft(parent, existing)`.
- [ ] Re-export from `TcInExpensesModal.jsx`.

### Task 2: Modal UI

- [ ] Build `TcInHireRecapModal.jsx` (LHS sections + RHS + Save).
- [ ] Add CSS for wide layout / accordion / results / themed cards.

### Task 3: Wire parent FE

- [ ] Swap modal import on `TcFixtureFormPage`.
- [ ] Ensure `tcInExpenses` round-trips full object on save payload.

### Task 4: Backend JSON

- [ ] `ensureTcInRecapJsonColumn`.
- [ ] Save JSON on create/update; hydrate on get (JSON wins over slave-only).
- [ ] Add SQL alter script.

### Task 5: Verify

- [ ] Lint touched files; smoke that parent still imports `calcTcInFinalHireage`.
