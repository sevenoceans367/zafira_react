# Legacy vs React calculation truth table (NAK-166)

**Authority:** Legacy pin `C:\Users\Lenovo\Desktop\Work\Zafira_legacy_pin` @ `93c44b4`  
`internal-user/sopf/laytime_calculation.php` `getFinalCalculation`  
**Runtime:** React `recomputePortDraft` unchanged on this remediation (owner gate).

Assumptions: tanker hours (`divider=1`, `divider1=24`), demurrage $20,000/day, dispatch $10,000/day, allowance 72h, deduction 4h @ 100%.

## Counting mix A (demurrage path)

| Row | Raw hrs | Flag | % | Weighted |
|---|---|---|---|---|
| 1 | 24 | C | 100 | 24 |
| 2 | 72 | C | 100 | 72 |
| 3 | 25 | C | 50 | 12.5 |
| Ded | 4 | — | 100 | 4 |

| Engine | Actual | Time to dem | Dem USD |
|---|---|---|---|
| **Legacy** | 108.5 (no ded in actual) | 108.5 − 72 − 4 = **32.5** | 32.5/24 × 20000 = **27083.33** |
| **React (current)** | 108.5 − 4 = 104.5 | 104.5 − 72 − 4 = **28.5** | **23750.00** |

## Counting mix B (despatch path)

| Row | Raw hrs | Flag | % | Weighted |
|---|---|---|---|---|
| 1 | 24 | C | 100 | 24 |
| 2 | 72 | NC | 0 | 0 |
| 3 | 25 | C | 50 | 12.5 |
| Ded | 4 | — | 100 | 4 |

| Engine | Actual | Time to despatch | Disp USD |
|---|---|---|---|
| **Legacy** | 36.5 | 72 − 36.5 = **35.5** (ded ignored) | 35.5/24 × 10000 = **14791.67** |
| **React (current)** | 36.5 − 4 = 32.5 | 72 − 32.5 = **39.5** | **16458.33** |

## Remediaton stance

Formulas left unchanged. Recorded in `docs/OWNER_DECISIONS.md`. Senior review must not treat this PR as financial-parity complete until owner chooses Legacy vs single-subtract.
