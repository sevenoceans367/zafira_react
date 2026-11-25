# Tanker SOF / Laytime allowance initialization — investigation + fix

Status: ready for independent senior review on PR #10.
Head: `d3175f6` (+ follow-up validation commits as pushed).
Base: `be328d07ae157717ac9a02af3bd224db2480e369` (merged #5/#8).
Legacy pin verified: `sevenoceans367/Zafira` @ `93c44b4b97c5d358be496018d90155f1d0525674`.

## Root cause

Modern SOF/Laytime returned blank contractual allowance whenever `laytime_master` was missing or had a blank `LAYTIME_ALLOWED`.
Zafira Legacy seeds that value from voyage estimate `freight_cost_estimete_master.TIMEALLOWED` via `getFun285()`.

## Verified Legacy semantics (pinned PHP)

| # | Question | Answer | Citation |
|---|---|---|---|
| 1 | Origin | Voyage-level `freight_cost_estimete_master.TIMEALLOWED` (UI: “Time Allowed (hrs)”) | `functions_…dryout.inc.php:12319`; `addcoaestimates.php:2066–2067` |
| 2 | Scope | Voyage-level value; **not** split across ports | `$la[]` push per non-TP port uses full `getFun285()` when no master (`laytime_calculation.php:1488`) |
| 3 | First / subsequent ports | Display uses saved `LAYTIME_ALLOWED` if truthy; else `$la[i]` for first port, `$la[i-1]` for later (`:1908`). With no masters, every `$la` entry is TIMEALLOWED → each LP/DP shows full voyage hours | `:1488`, `:1908` |
| 4 | Reversible / carryover | Separate Tanker UI copies previous port allowance when reversible; not part of estimate seed | JS + reversible fields in same file |
| 5 | Transit ports | Excluded from laytime tabs (`PORT != 'TP'`) | `:1364`, `:1384` |
| 6 | Tanker turn time | Fun158==2: add turn hours to `data-value` base (`:599–616`) | `:556–625` |
| 7 | Both missing | Blank / space display; JS treats empty as 0 for some calcs | `:1908`, `:405–408` |
| 8 | Explicit zero | Legacy PHP falsy `"0"` can fall through to `$la` — **modern keeps explicit 0 as override** | intentional deviation |
| 9 | Units | TIMEALLOWED labeled hours; Fun158 1\|2 hours, 3 days | estimate form + `getFun158` |
| 10 | Incomplete master | Legacy `$la` uses `ACTUAL_LAYTIME` when master row exists (`:1488`), which can blank the Fun285 seed. **Modern still falls back to TIMEALLOWED when `LAYTIME_ALLOWED` is blank** | intentional deviation |

VC-Out loader assigns `var_285 = TIMEALLOWED` (`:12319`).
VC-In loader `viewFreightCostEstimationTempleteRecordsNewForVcIn` does **not** assign `var_285` (verified around `:19430+`).

Do **not** use Bainbridge PHP as parity authority: it has a dead `getFun285` stub and no TIMEALLOWED/`$la` seed path.

## Production / local data evidence

Owner-supplied production browser GETs:

| COMID | Vessel | FCAID | estimate API timeAllowed | SOF allowance |
|---|---|---:|---:|---|
| 4 | POLYAIGOS | 36 | 108.00 | blank (no matching masters) |
| 18 | SEDNA | 108 | blank | blank |
| 20 | ANTARES | 111 | 3.500 | blank |

Local `zafira` DB (laptop fixture, not production clone):

| Case | TIMEALLOWED | WORKING_DAYS | Contractual seed |
|---|---:|---:|---|
| FCAID 36 POLYAIGOS | 108.00 | 5.590 | **108.00** (TIMEALLOWED) |
| FCAID 6 ANTARES-like | NULL | 3.500 | **unknown** (do not promote WORKING_DAYS) |
| Both null | NULL | NULL | **unknown** |

Estimate API `timeAllowed: TIMEALLOWED ?? WORKING_DAYS` can surface voyage days as if they were laytime hours (ANTARES 3.500). SOF/Laytime seed intentionally ignores `WORKING_DAYS`.

## Modern fix

Shared helper: `backend/src/services/laytimeAllowance.js`

```
if TP → unknown/transit
else if explicit saved LAYTIME_ALLOWED (incl. 0) → use it
else if TIMEALLOWED present → use it (full voyage hours per LP/DP)
else → unknown (blank; no fictitious finance)
```

Wired into:

- `sofDb.js` `loadLaytimeData` (+ load `TIMEALLOWED` with the cost sheet)
- `laytimeDb.js` `mapMasterFields` / form load

Preserved: hourly Tanker math, Dry days, LT(C)/LT(NC), partials, deductions, unknown-unit write block, Open guard.

Tests registered in `backend/package.json`: `laytimeAllowance.test.js`, `laytimeRateUnit.test.js`.

## Runtime validation (local `zafira` fixture)

See [artifacts/tanker-sof-laytime-allowance-validation-report.md](artifacts/tanker-sof-laytime-allowance-validation-report.md).

| Scenario | Result |
|---|---|
| A matrix (browser + API) | PASS |
| B multi-row toggle/delete | PASS (automated helper; registered test) |
| C saved override | PASS |
| D skeleton master | PASS |
| E blank TIMEALLOWED | PASS |
| F WORKING_DAYS not seeded | PASS |

## Remaining risks / not claimed as full parity

- Production COMIDs 18/20 not in local DB; need authorized read-only prod SELECT.
- Modern estimate detail still **reads** `TIMEALLOWED ?? WORKING_DAYS` and **writes** `timeAllowed` → `WORKING_DAYS` — separate defect; not changed here.
- VC-In voyages: Legacy Fun285 unset → seed stays blank unless saved master exists.
- Reversible previous-port copy UX not reworked here.
- Dry-cargo / unknown-unit write / PDF: not re-proven in this validation pass (unchanged code paths).
- Scenario B browser UI pass not run (helper/regression test covers the arithmetic).

## Manual QA checklist (owner)

1. POLYAIGOS-like voyage: TIMEALLOWED=108, no laytime_master → SOF Activity remaining matches 84/96/102/103.2/108/0 matrix.
2. Multi-row Activity reorder/toggle LT(C)/LT(NC)/delete preceding row.
3. Saved LAYTIME_ALLOWED (incl. 0) wins over estimate.
4. Save SOF Activity creating skeleton master → reload still shows estimate TIMEALLOWED.
5. SEDNA-like (no TIMEALLOWED) → duration works; cumulative stays blank (unknown).
6. WORKING_DAYS-only sheet must **not** seed SOF/Laytime allowance.
7. Dry Cargo regression; unknown-unit save rejected; PDF units unchanged for known hours.
