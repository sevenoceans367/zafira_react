## Summary
- Remediates senior review **REQUEST CHANGES** on NAK-166 Tanker Laytime (head was `7e3bef1`).
- Tanker-only (`estimateType === 2`): Legacy-aligned save validation (no hidden Dry mandatory fields), FE+BE LT partial/date/rate validation, gated nego (not Final Demurrage), QTY no longer overwrites contractual allowance, Charterer SQL Legacy parity, CSS scoped under `.ltTankerRoot`, Tanker LT insert fail-closed.
- `recomputePortDraft` **unchanged** — deduction discrepancy recorded in `docs/OWNER_DECISIONS.md` + `LEGACY_TRUTH_TABLE.md`. No migrations / nego storage invent.
- Footer notice matches shipped SOF gray chrome; instructional Submit/Close copy (no false Unsaved).

## Remediation evidence (COMID 4 Tanker · COMID 8 Dry)

### Calculated Demurrage FAB / summary (not nego)
![Calc Demm FAB](pr-assets/nak-166/after/03-remediation-top-calc-demm.png)
![Expanded Calculated Demurrage](pr-assets/nak-166/after/04-remediation-summary-calculated.png)

### Nego gated + DP tab
![Nego gated](pr-assets/nak-166/after/05-remediation-nego-gated.png)
![DP-Balongan](pr-assets/nak-166/after/06-remediation-dp-balongan.png)

### Dry regression + gray footer
![Dry COMID 8](pr-assets/nak-166/after/07-dry-com8-regression.png)
![Gray footer + summary](pr-assets/nak-166/after/08-remediation-footer-gray-summary.png)

## Owner decisions still open
- Deduction application vs Legacy (A04–A07, A12) — formulas gated unchanged
- Nego persistence / approval / reports — UI disabled until approved storage contract
- All Clear / Laytime Ends / DEMM Starts / Agent mapping — em dash
- A09 Legacy zero-actual dispatch anomaly — not production requirement until owner confirms

## Test plan
- [x] `node --test` tanker helpers + FE/BE validation (25/25)
- [x] Fresh Tanker save without `loadedRate`; reject invalid LT %; SQL LT flag readback
- [x] Browser LP/DP, Calc Demm, nego gated, Dry COMID 8 regression
- [x] Gas: no ESTIMATE_TYPE=1 rows in local DB (noted)
- [ ] Do not merge until senior re-review clears + owner decisions on disputed formulas/nego

## References
- [NAK-166](https://linear.app/nakii/issue/NAK-166/laytime-tanker-new-layout-sof-integration-and-financial-parity)
- Legacy pin: `Zafira_legacy_pin` @ `93c44b4`
- Validation log: `pr-assets/nak-166/VALIDATION.md`
