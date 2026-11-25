# NAK-166 Independent Tanker Laytime QA

**Run date:** 2026-11-25
**PR:** https://github.com/sevenoceans367/zafira_react/pull/17
**Tested source:** current PR head `489aeb32ebc2648caf87c1bd721978b0c4cc4b4e` (`feat/nak-166-laytime-tanker-layout`)
**Reviewed head supplied in request:** `863ef51639323695587b3cfb1cc05931c3092fd5` (superseded)
**Legacy source pin:** `C:\Users\Lenovo\Desktop\Work\Zafira_legacy_pin` at `93c44b4b97c5d358be496018d90155f1d0525674`
**Design source:** supplied `Laytime_Tanker_6.html` attachment (`f7aa6b39-397d-42c9-86e0-b443b4681ca6`)

## Outcome

**Partial QA; no production merge recommendation.** The code head, source oracles, local test suites, production build, and isolated database identity were checked. Desktop browser interaction and new screenshots could not be performed in this run: the T3 preview service reported unavailable, Chrome attachment failed with “Browser attachment requires a network policy,” and local frontend ports 5173/5174 had no listener. The running API on 3001 was excluded from business-data testing because the feature worktree `.env` points to shared XAMPP port 3306. No API writes, database writes, Legacy writes, commits to the feature branch, merges, or deployments were made.

Earlier implementation-thread API/SQL evidence is excluded from acceptance because that thread records its database as port 3306. Author-provided screenshots on the evidence branch are references only and were not captured by this independent run. No screenshot is represented as new evidence.

## Source and environment checks

| Check | Result | Evidence |
|---|---|---|
| PR head | PASS | GitHub PR #17 currently points to `489aeb32…`; requested `863ef516…` is no longer current. |
| Legacy pin | PASS | Worktree HEAD matches `93c44b4…`; `internal-user/sopf/laytime_calculation.php`, `getFinalCalculation` begins at line 297. |
| Design tokens | PASS (source only) | Supplied HTML declares navy `#274670/#E6EAF1`, orange `#F4652C/#FDECE4`, blue `#3B82F6/#EAF1FE`, green `#0FA836/#E8F8EC`, gray `#5B6472/#EEF0F3`. Rendered parity is NOT TESTED. |
| Isolated DB identity | PASS (read-only) | Direct connection returned port `13417`, datadir `D:\Codeit\zafira-sof-audit-20261124\mariadb\`, database `zafira`. No writes were made. |
| COMID 4 clone coverage | BLOCKED | Clone has one `sof_master` row and one `laytime_master` row, both LP (`PORTID=7824`); one activity row is present (`LT_C=1`, `LT_NC=0`, `LT_PARTIAL=100`, 24.0000h, cumulative 84). There is no DP row here, so multiport/LP-DP isolation cannot be demonstrated. This readback is not proof of API or UI parity. |
| Browser attachment | BLOCKED | T3 preview `available=false`; CUA Chrome attach failed on network policy; local frontend ports 5173 and 5174 refused connections. |
| Connected API | NOT TESTED for feature behavior | `/api/health` on 3001 returned connected DB `zafira`, but did not report its port. Worktree `.env` names 3306, so no business endpoint was called. |

## Automated checks

| Check | Result |
|---|---|
| `npm test --prefix frontend` | PASS — 106 tests, 0 failures. |
| `node --test frontend/pages/internal-user/ops/laytimeTankerHelpers.test.js frontend/pages/internal-user/ops/laytimeTankerValidation.test.js` | PASS — 23 tests, 0 failures. These are helper/validation tests, not browser acceptance. |
| `npm test --prefix backend` | PASS — 68 tests, 0 failures. Configured suite does not include a Laytime DB end-to-end suite. |
| `npm run build --prefix frontend` | PASS — Vite production build completed; existing large-chunk warning (>500 kB). |
| `git diff --check` on feature worktree | PASS — clean. No tracked feature files were modified. |

## Required evidence matrix

`NOT TESTED` means this run did not observe the requested behavior. Source/helper calculations are explicitly labeled and are not treated as UI/API/SQL observations.

| Test ID | Scenario | COMID / Port | Exact inputs | Legacy observed | Expected result | React observed | API result | SQL readback | Reload result | Verdict | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| VIS-1920 | Full page, top/middle/bottom, sidebar expanded/collapsed; all sections and footer | 4 LP + DP | 1920×1080 | NOT TESTED in runtime | Match HTML/SOF chrome; summary never covers gray footer actions | NOT TESTED | NOT TESTED | N/A | NOT TESTED | BLOCKED | No fresh browser capture; prior author shot `after/19-docked-desktop-unavailable.png` is reference only. |
| VIS-1536 | Same visual and summary states | 4 LP + DP | 1536×960 | NOT TESTED | Same | NOT TESTED | NOT TESTED | N/A | NOT TESTED | BLOCKED | No fresh browser capture. |
| VIS-1440 | Same visual and summary states | 4 LP + DP | 1440×900 | NOT TESTED | Same | NOT TESTED | NOT TESTED | N/A | NOT TESTED | BLOCKED | No fresh browser capture. |
| VIS-1280 | Same visual and summary states | 4 LP + DP | 1280×800 | NOT TESTED | Same | NOT TESTED | NOT TESTED | N/A | NOT TESTED | BLOCKED | No fresh browser capture. |
| VIS-1024 | Same visual and summary states | 4 LP + DP | 1024×768 | NOT TESTED | Same | NOT TESTED | NOT TESTED | N/A | NOT TESTED | BLOCKED | No fresh browser capture. |
| VIS-SECTIONS | Details/options, ribbons, C/NC, partial/cumulative/duration/net, search/paging/add/delete, summaries, approvers, remarks/attachments, locked/editable, gray footer, Save/Close | 4 LP + DP | Expanded/collapsed summary; top/middle/bottom; expanded/collapsed sidebar | NOT TESTED | All sections usable; footer actions always visible | NOT TESTED | NOT TESTED | N/A | NOT TESTED | BLOCKED | Prior evidence branch shots 01–23 are not independent captures. |
| DATA-4 | Cargo/quantity, terminal, operator/charterer, NOR tendered/accepted, cargo commenced/completed, laytime start/allowance, SOF activity identifiers; saved-Laytime precedence; port/voyage isolation; blank vs zero | 4 LP + DP | Clone read-only; compare React API, Legacy route and SQL | Legacy runtime NOT TESTED | Multiple LP/DP records, matching keys and no cross-port/voyage bleed | API/UI NOT TESTED | NOT TESTED | Clone contains one LP SOF/Laytime record; no DP. The existing Laytime master has one 24.0000h C100 activity and allowance 108; no API parity or seed-precedence claim. | NOT TESTED | BLOCKED | Read-only SQL query; insufficient fixture cardinality. |
| LOOKUP | Charterer mapping across COA, lump-sum, customer and shipper/charterer cases | Suitable tanker fixtures | Each Legacy branch and vendor identifier | Source at `laytime_calculation.php`; runtime NOT TESTED | Resolve exact Legacy charterer per case | NOT TESTED | NOT TESTED | No scenario matrix readback | NOT TESTED | BLOCKED | Current service has branches in `laytimeDb.js:676–750`; no representative fixture/API comparison. |
| A01 | Counting mix / dispatch | Synthetic; hours | Allow 72h; 24h C100, 12h C50, 6h NC; demurrage $24k/day, dispatch $12k/day; extra 0; no deduction | Runtime NOT TESTED; supplied source expectation: actual 30h, dispatch $21,000 | Same | UI NOT TESTED. Helper source run: actual 30.0000h; time dispatch 42.0000h; $21,000.00; cumulatives 48, 42, 0 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | Helper-only calculation; no browser/API/SQL evidence. |
| A02 | Allowance boundary | Synthetic; hours | Allow 72h; 72h C100; rates as baseline | Runtime NOT TESTED; supplied expectation $0 | Same | UI NOT TESTED. Helper: actual 72.0000h; dem/dispatch 0; $0 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | Helper-only. |
| A03 | Demurrage | Synthetic; hours | Allow 72h; 100h C100; baseline rates | Runtime NOT TESTED; supplied expectation demurrage 28h / $28,000 | Same | UI NOT TESTED. Helper: actual 100.0000h; dem 28.0000h; $28,000 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | Helper-only. |
| A04 | Deduction on demurrage | Synthetic; hours | Allow 72h; 100h C100; 4h D100; baseline rates | Runtime NOT TESTED; supplied expectation actual 100h, dem 24h / $24,000 | Owner decision unresolved | UI/summary NOT TESTED. Helper: raw/weighted activity 100/100h; cumulative −28h; deduction gross/net 4/4h; actual 96h; dem 20h / $20,000 | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Legacy vs React deduction application requires owner decision; source result only. |
| A05 | Deduction on dispatch | Synthetic; hours | Allow 72h; 60h C100; 8h D50; baseline rates | Runtime NOT TESTED; supplied expectation dispatch $6,000 | Owner decision unresolved | UI/summary NOT TESTED. Helper: raw/weighted activity 60/60h; cumulative 12h; deduction gross/net 8/4h; actual 56h; dispatch 16h / $8,000 | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Owner decision; source result only. |
| A06 | Negative demurrage edge | Synthetic; hours | Allow 72h; 74h C100; 4h D100; baseline rates | Runtime NOT TESTED; supplied expectation demurrage −2h / −$2,000 | Owner decision unresolved | UI/summary NOT TESTED. Helper: raw/weighted activity 74/74h; cumulative −2h; deduction gross/net 4/4h; actual 70h; dispatch 2h / $1,000 | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Owner decision; source result only. |
| A07 | Negative demurrage edge | Synthetic; hours | Allow 72h; 77h C100; 4h D100; baseline rates | Runtime NOT TESTED; supplied expectation demurrage 1h / $1,000 | Owner decision unresolved | UI/summary NOT TESTED. Helper: raw/weighted activity 77/77h; cumulative −5h; deduction gross/net 4/4h; actual 73h; dem −3h / −$3,000 | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Owner decision; source result only. |
| A08 | Fractional partials | Synthetic; hours | Allow 72h; 5h30 C25, 2h15 C50; baseline rates | Runtime NOT TESTED; supplied expectation actual 2.5h, dispatch $34,750 | Same | UI NOT TESTED. Helper: 2.5000h; dispatch 69.5000h / $34,750; cumulatives 70.6250, 69.5000 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | Helper-only. |
| A09 | Zero counted hours | Synthetic; hours | Allow 72h; 10h NC100; baseline rates | Runtime NOT TESTED; supplied Legacy result $864,000 is anomalous | Owner decision unresolved | UI NOT TESTED. Helper: actual 0h; dispatch 72h / $36,000 | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Explicit owner decision required; source result only. |
| A10 | Explicit zero allowance | Synthetic; hours | Allow 0h; 12h C100; baseline rates | Runtime NOT TESTED; supplied expectation demurrage $12,000 | Same | UI NOT TESTED. Helper: actual 12h; dem 12h / $12,000 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | Helper-only. Blank allowance not equivalent to this case. |
| A11 | Additional laytime | Synthetic; hours | Allow 72h; 68h C100; additional 5h; baseline rates | Runtime NOT TESTED; supplied expectation demurrage $1,000 | Same | UI NOT TESTED. Helper: actual 73h; dem 1h / $1,000 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | Helper-only. |
| A12 | Fractional deduction | Synthetic; hours | Allow 72h; 75h C100; 1h D33.33; baseline rates | Runtime NOT TESTED; supplied expectation demurrage $2,666.70 | Owner decision unresolved | UI/summary NOT TESTED. Helper: raw/weighted activity 75/75h; cumulative −3h; deduction gross/net 1/0.3333h; actual 74.6700h; dem 2.3367h / $2,336.70 | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Owner decision and decimal behavior require runtime confirmation. |
| VAL-PCT | LT Partial | COMID 4 LP | `0, 25, 50, 100, 100.01, 150, -5`; then critical invalid-draft edit/toggle/insert/delete/save/correct/save/reload sequence | NOT TESTED | Accept 0–100; invalid calc unavailable; Save rejects; corrected values restore | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Helper tests pass generally; exact browser sequence not run. |
| VAL-NUM | Allowance, quantity, rates | COMID 4 LP | Blank vs 0; negative quantity/rates; `1,000`, `1,0`, `0x10`, `10abc` | NOT TESTED | Strict consistent parse/reject; no misleading zeros | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | No browser/API validation this run. |
| VAL-DATE | Calendar/date/time ranges | COMID 4 LP | 31-02-2026; hour 25; invalid minutes; trailing junk; reversed; missing end; leap-year valid; midnight/multiday; optional blanks | NOT TESTED | Reject malformed/reversed/incomplete active range; allow valid leap and optional blanks | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | No browser/API validation this run. |
| VAL-DURATION | Submitted duration vs dates | COMID 4 LP | Valid dates + blank, incorrect, or exact duration | NOT TESTED | Blank derives from dates or is rejected by approved rule; mismatch rejected | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | `durationForPersist` exists in current backend source; no payload/readback run. |
| SAVE-APPROVAL | Fresh LP/DP, saved records, port switch/reload, approver add/remove, submit, close/open, locked/unauthorized/cross-company, rollback | COMID 4 + valid fixtures | Local authorized account; isolated DB only | NOT TESTED | Existing workflow preserves fields and enforces permissions/transactionality | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | No write requests issued. |
| PERSIST | Activities/deductions, attachments, client totals | COMID 4 + valid fixtures | Read/write/reload exact `LT_C`, `LT_NC`, `LT_PARTIAL`, `CUMMULATIVE_TIME`, `SOFLOADPORTID`, dates/durations; incorrect financial totals | NOT TESTED | Backend rejects/recalculates safely; exact SQL and reload parity | NOT TESTED | NOT TESTED | Only existing clone row read; no write | NOT TESTED | BLOCKED | No isolated API write/reload run. |
| CAL-EXT | Reversible laytime, detention, turn time, manual financial overrides, and multiport calculations | Suitable tanker fixtures | Exercise each toggle/input and compare per-port and aggregate figures | NOT TESTED | Independently derive each result from Legacy and approved owner rule | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | No browser/API execution; aggregate business rules remain unconfirmed. |
| ACCESS | Keyboard, axe, focus, labels, contrast, Escape, restoration, zoom, reduced motion | COMID 4 LP | Keyboard-only; zoom 100/125/150/200%; normal text 4.5:1 | NOT TESTED | All controls named, focused and unobscured; AA contrast | NOT TESTED | N/A | N/A | NOT TESTED | BLOCKED | No browser session; no axe audit. |
| REG-DRY | Dry Laytime + COMID 8 and Dry SOF | COMID 8 | Existing approved fixture | NOT TESTED | Existing journeys intact | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Full frontend/backend suites pass; no browser fixture proof. |
| REG-GAS | Gas Laytime/SOF | Suitable fixture unavailable in verified clone | Existing suitable fixture required | NOT TESTED | Existing journeys intact | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | No Gas fixture in the verified COMID 4 clone read. |
| REG-COMP | Tanker SOF, date picker, approval and attachment components | COMID 4 | Existing fixture | NOT TESTED | Existing journeys intact; additive date-picker prop remains compatible | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | BLOCKED | Automated suites only; no browser use. |

## Known owner gates and source-derived discrepancies

Owner record `docs/OWNER_DECISIONS.md` and the current PR reviews leave deduction settlement and zero-actual dispatch unresolved. Legacy pin `getFinalCalculation` (`laytime_calculation.php:449–529`) applies deductions once on the demurrage branch and ignores them on dispatch; React `recomputePortDraft` (`frontend/pages/internal-user/ops/laytimeCalculations.js:63–151`) subtracts deductions from actual and again on demurrage. Do not call A04–A07, A09, or A12 contractually accepted, and do not change formulas without the owner decision.

The saved screenshots show the gray SOF-style footer and content-docked summary in the existing evidence branch, including 390/320/200% captures (`after/19`–`after/23`). They remain author-provided snapshots; this run did not verify hover/focus states, the requested desktop widths, section journeys, data correctness, or the HTML comparison in a live browser.

## Separate verdicts

1. **Desktop visual acceptance — BLOCKED.** No live browser connection or fresh captures.
2. **Functional correctness — BLOCKED.** Automated checks pass; save/approval/lock/access/write behavior not exercised.
3. **SOF and SQL parity — BLOCKED.** Clone identity is valid, but only one LP record was available and no API/Legacy runtime comparison ran.
4. **Financial correctness — BLOCKED.** A01–A03/A08/A10/A11 are helper-only; A04–A07/A09/A12 remain owner-decision blocked.
5. **Accessibility — BLOCKED.** Keyboard and axe were not run.
6. **Regression safety — BLOCKED.** Automated suites/build pass; Dry/Gas and SOF browser regression journeys not run.
7. **Production merge readiness — NO.** Required independent desktop/API/SQL evidence and owner decisions remain outstanding.
