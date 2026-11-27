# Owner decisions — Laytime Tanker (NAK-166)

## Deduction application (demurrage)

Tanker Laytime follows Zafira Legacy getFinalCalculation at pin 93c44b4, lines 449 to 470.
Actual Laytime includes weighted counting time and reversible carry. The weighted
deduction is applied once when calculating demurrage. Despatch uses the difference
between allowed and actual time.

With 72 hours allowed, 100 hours counted, a 4-hour weighted deduction, and a
$20,000/day rate, demurrage is 24 hours or $20,000.

When weighted deductions exceed the gross time on demurrage, Save blocks the
negative calculated amount. The commercial treatment of that crossover still
needs confirmation.

## Nego Dialogues

Current Legacy and React schemas have no negotiation dialogue storage. The Tanker table uses labeled mock entries held in memory for UI testing. Its mock total is separate from the calculated demurrage shown in the summary and from the Laytime save payload.

## All Clear / Laytime Ends / DEMM Starts / Agent

These are **not** blocked on new `laytime_master` columns / migrations.

- **Agent (read-only, Tanker):** use the newest ordinary `KIND_ATTN_TO='nomination'` agency letter for the same voyage, company and port call. Exclude OPA via `LP_DP='Yes'` when that column exists. Fall back to the company-scoped worksheet vendor for the LP, DP or TP. The field shows a dash when neither source identifies an agent.
- **All Clear / Laytime Ends / DEMM Starts:** editable through existing `laytime_slave2` rows. Fresh Tanker forms keep all `sof_slave_6` point events and fill missing named fields from `sof_slave_3`. Saved blanks take precedence. Edits and clears update all aliases for the field, and Save validates each alias by timestamp.
- Do **not** infer Laytime Ends from cargo completion or DEMM Starts from allowance without a separate approved formula decision.
