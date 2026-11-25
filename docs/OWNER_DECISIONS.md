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

- **Agent (read-only):** ordinary agency letter vendor (`generate_agency_letter` + company-scoped `vendor_master`) first, then leg nominated `PORT_COSTLP_VENDOR` / `PORT_COSTDP_VENDOR` with company scope. OPA letters skipped. Dash is valid when no nomination exists. Exposed as `port.agentName`.
- **All Clear / Laytime Ends / DEMM Starts:** editable through existing `laytime_slave2` ENTITY_NAME/ENTITY_VALUE rows. Tanker fills missing named fields from SOF point events (`sof_slave_6`) and `sof_slave_3` when saved rows omit them; cleared saved blanks win over SOF. Strict date validation on Save (blank OK).
- Do **not** infer Laytime Ends from cargo completion or DEMM Starts from allowance without a separate approved formula decision.
