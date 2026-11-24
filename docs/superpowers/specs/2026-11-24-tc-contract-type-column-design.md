# TC Recap CONTRACT_TYPE Column — Design

**Status:** Approved (Gemini 4 Argon + product lean)  
**Date:** 2026-11-24  
**Scope:** All Time Charter Recaps (`chartering_estimate_tc_master`), all business types (Tankers / Gas / Dry). Not tanker-only.

## Problem

Saving as **TC Out** currently clears `TC_IN_RECAP_JSON`. Product wants Hire Recap JSON to stay dormant so flipping back to **TC In/TC Out** restores P&L without re-entry. Inference-only mode cannot do that without list/form disagreement.

## Decision

Add `CONTRACT_TYPE VARCHAR(16) NULL` (`tcout` | `tcinout`) on `chartering_estimate_tc_master`. Keep JSON when TC Out; gate active P&L / slave2–4 on mode; list badge prefers column.

## NULL / migration semantics

| Phase | `CONTRACT_TYPE` | Behavior |
|-------|-----------------|----------|
| Right after `ADD COLUMN` | all `NULL` | Read path falls back to period/JSON inference (legacy-safe) |
| After backfill on clone | every row `tcout` or `tcinout` | Explicit mode; no inference needed |
| New saves | always written | Never leave NULL on write |

## DDL test constraint

All DDL + backfill first on a **cloned** database only. Never production `zafira` until clone matrix passes.

## Related docs

Executable plan: `docs/superpowers/plans/2026-11-24-tc-contract-type-column.md`
