# Owner decisions — Laytime Tanker (NAK-166)

Unresolved product / formula items that are **not** claimed as parity in runtime code.

## Deduction application (demurrage) — unresolved discrepancy

Legacy `getFinalCalculation` (pin `93c44b4` ~450–466):
- `actual` = weighted counting sum + reversible extra (**deductions not removed from actual**)
- Demurrage path: `dem = actual − allowed − (ΣdedPartial / divider)` (deductions applied **once**, on demurrage only)
- Despatch path: `allowed − actual` (deductions ignored)

React `recomputePortDraft` currently:
- Subtracts deductions from `actual`, **and** subtracts them again on the demurrage path

Example (72h allowed, 108.5h counting, 4h deduction, $20k/day): Legacy dem ≈ 32.5h / $27,083; React dem ≈ 28.5h / $23,750.

**Owner decision needed:** match Legacy literally, or adopt a single-subtract rule. Do **not** change `laytimeCalculations.js` until decided. Runtime does **not** claim formula parity.

## Nego Dialogues

No `laytime_slave2` / master persistence for negotiation rows. Production Tanker UI shows a disabled gated panel only. FAB “Calc Demm” uses calculated `ttlDemurrage`, never a session nego sum.

## All Clear / Laytime Ends / DEMM Starts / Agent

These are **not** blocked on new `laytime_master` columns / migrations.

- **Agent (read-only, Tanker):** ordinary `KIND_ATTN_TO='nomination'` agency letter first (skip OPA via `LP_DP='Yes'` when that column exists; never treat pda/bunker/voyage as nomination), then company-scoped leg `PORT_COSTLP/DP_VENDOR`. Dash is valid when no nomination exists. Dry/Gas keep prior unscoped leg vendor only.
- **All Clear / Laytime Ends / DEMM Starts:** editable through existing `laytime_slave2` rows. Fresh/empty-saved Tanker keeps **all** `sof_slave_6` point events and adds only missing named fields from `sof_slave_3`. Saved non-empty rows preserved; blanks win. Every alias row validated strictly on Save (including duplicates/conflicts).
- Do **not** infer Laytime Ends from cargo completion or DEMM Starts from allowance without a separate approved formula decision.
