# Tanker SOF / Laytime allowance initialization — investigation handoff

Status: draft, implementation pending. Base: be328d07ae157717ac9a02af3bd224db2480e369 (merged #5/#8).

## Observed production evidence (read-only browser GET, owner supplied)
| COMID | Vessel | FCAID | estimate API timeAllowed | SOF allowance |
| --- | --- | --- | --- | --- |
| 4 | POLYAIGOS | 36 | 108.00 | blank for all three ports |
| 18 | SEDNA | 108 | blank | blank for all four ports |
| 20 | ANTARES | 111 | 3.500 | blank for all four ports |

All SOF responses estimateType=2, rateUnit=hours, laytimeId blank. Laytime API for COMIDs 18/20 also returned no matching master IDs or allowances. Local test POLYAIGOS LP-Balongan has manually configured laytimeId=3, allowance=108 hours; 24h C/100%, 12h NC, 24h C/50% gave 84/0/72. Do not confuse the test fixture with production. The estimate API coalesces TIMEALLOWED and WORKING_DAYS; raw column provenance, unit and allocation of 3.500 are not established.

## Actual Zafira Legacy source (not Bainbridge)
Repository sevenoceans367/Zafira, snapshot 93c44b4b97c5d358be496018d90155f1d0525674.
- internal-user/dryout/laytime_calculation.php:81–90 resolves VC-In/Out source; 1365–1490 excludes TP and fills $la using getFun285() when no matching record; 1908 uses saved allowance or indexed $la; 556–625 initializes Tanker allowance from data-value, adds turn-time hours and recalculates; 402–463 calculates remaining balance and actual hours.
- includes/functions_internal_user_dryout.inc.php:10835–10857 latest worksheet lookup; 12011–12021 loads freight_cost_estimete_master; 12319 maps var_285 to TIMEALLOWED; 1504–1507 getter; 19430 onward VC-In loader reads freight_cost_estimete_in_master and inspected function does not assign var_285. Investigate actual routing, allocation, worksheet copy, saved-zero behavior and reversible/previous-port carryover; do not blindly reproduce legacy bugs.
- Compare dryout/sof.php and sopf/sof.php with laytime_calculation.php: original SOF records events, new React design brings Laytime functionality into SOF.

## Modern gaps and required evidence
- sofDb.js:461–531 reads only laytime_master, returns blank without master; 1543–1566 can create a master without allowance when saving activities. laytimeDb.js:516–520 maps only saved allowance. Restore verified shared allowance resolution across both screens; distinguish absent master, skeleton master, unknown, explicit zero and persisted override.
- estimateDetailDb.js:990 reads TIMEALLOWED ?? WORKING_DAYS; :2802 and :2935 inspected update writes WORKING_DAYS from timeAllowed. Audit raw columns, actual schema, create/update/copy paths, units, VC-In/Out, and Legacy estimate form before deciding fix. Do not treat 3.500 as hours or days without evidence. Do not replicate full allowance on every port or borrow LP/DP allowance for TP.
- Keep existing weighted activity, NC, deductions, hourly finance/PDF, Open guard, and Dry behavior intact. Validate stale concurrency, safe save/reload and no financial interpretation of unknown allowance. Include real regression tests in npm test (laytimeRateUnit.test.js currently omitted).
- Read-only production GET/SELECT only, no synthetic saves, DDL, migrations, production config changes, deploy or merge. Run writes only on verified isolated cloned DB. Validate actual browser/API with configured and unconfigured cases; provide source links, exact identities, raw columns/units, before/after tables, test commands/results, screenshots and remaining blockers. If ambiguous, preserve unknown and escalate with evidence.
