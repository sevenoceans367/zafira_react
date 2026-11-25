# Tanker SOF/Laytime allowance — runtime validation

**Branch:** `fix/tanker-sof-laytime-allowance-initialization`  
**HEAD:** `d3175f6cdd3eba462200e34180d496f1f3382617`  
**Runtime:** `npm run dev` → frontend `http://localhost:5173`, backend `http://localhost:3000`, `DB_NAME=zafira`  
**Auth:** staff session via local fixture user `support` (API login OK; browser localStorage session)  
**Code changes by this validation:** none (no new commits)

## Scenario results

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| A | POLYAIGOS-like: no master → 108; 24h remaining matrix | **PASS** | API SOF/Laytime COMID 4 DPs seed `108.00`. Browser DP-Advario Activity remaining: C/100%=`84.0000`, C/50%=`96.0000`, C/25%=`102.0000`, C/20%=`103.2000`, C/0%=`108.0000`, NC=`0.00`. Helper matrix script also ALL_PASS. |
| B | Multi-row Activity reorder/toggle/delete | **PASS** | Automated `sofScenarioB.test.js`: 108h seed → 84/0/72; middle C/100→60, C/50→66, NC→72; delete row1 → 0/96. Registered in frontend `npm test`. |
| C | Saved override wins | **PASS** | Temp `laytime_master` id 3 `LAYTIME_ALLOWED=50` → SOF LP=`50`, DPs still `108.00`; restored to `108`. |
| D | Incomplete skeleton master still seeds TIMEALLOWED | **PASS** | Saved SOF Activity on DP-7798 with version token → created `sof_master` SOFID 7 + `laytime_master` LAYTIME_ID 5 with `LAYTIME_ALLOWED=NULL`; reload allowance still `108.00`. |
| E | Unknown when TIMEALLOWED blank | **PASS** | COMID 7 / FCAID 37 (`TIMEALLOWED` NULL). SOF API ports blank allowance. Browser SOF: 24h Activity cumulative `—`. Laytime UI: `LAYTIME ALLOWED —hrs` on all tabs. |
| F | WORKING_DAYS must not seed | **PASS** | Temp `TIMEALLOWED=NULL` on FCAID 18 (COMID 2 latest sheet; WORKING_DAYS `1.760`); SOF LP/DP allowances blank (not `1.760`); restored `0.00`. |

## Screenshots / artifacts

- [docs/reviews/artifacts/sof-comid4-lp-balongan.png](sof-comid4-lp-balongan.png) — SOF COMID 4 LP-Balongan
- [docs/reviews/artifacts/sof-comid4-dp-advario-c100-remaining-84.png](sof-comid4-dp-advario-c100-remaining-84.png) — DP-Advario C/100% remaining `84.0000`
- [docs/reviews/artifacts/laytime-comid4-dp-advario.png](laytime-comid4-dp-advario.png) — Laytime DP-Advario (page shows `LAYTIME ALLOWED 108.00hrs` in DOM text)
- JSON: `sof4-summary.json`, `scenarios-cd-report.json`, `scenario-d-report.json`, `validate-allowance-report.json`

## Local fixture side effects (zafira only)

- Created SOFID `7` + LAYTIME_ID `5` for COMID 4 / DP / PORTID 7798 / RANDOMID 84814 (scenario D).
- Temporary UPDATEs for C and F were restored.

## Not claimed

- Scenario B browser multi-row reorder parity
- Dry-cargo regression / unknown-unit write / PDF units
- Production COMIDs 18/20 (SEDNA/ANTARES) — not in local fixture
