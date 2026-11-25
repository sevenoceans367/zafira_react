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

Current Legacy and React schemas have no negotiation dialogue storage. The Tanker table uses labeled mock entries held in memory for UI testing. Its mock total is separate from the calculated demurrage shown in the summary and from the Laytime save payload.

## All Clear / Laytime Ends / DEMM Starts / Agent

These are **not** blocked on new `laytime_master` columns / migrations.

- **Agent (read-only, Tanker):** use the newest ordinary `KIND_ATTN_TO='nomination'` agency letter for the same voyage, company and port call. Exclude OPA via `LP_DP='Yes'` when that column exists. Fall back to the company-scoped leg `PORT_COSTLP/DP_VENDOR`. The field shows a dash when neither source identifies an agent.
- **All Clear / Laytime Ends / DEMM Starts:** editable through existing `laytime_slave2` rows. Fresh Tanker forms keep all `sof_slave_6` point events and fill missing named fields from `sof_slave_3`. Saved blanks take precedence. Edits and clears update all aliases for the field, and Save validates each alias by timestamp.
- Do **not** infer Laytime Ends from cargo completion or DEMM Starts from allowance without a separate approved formula decision.
