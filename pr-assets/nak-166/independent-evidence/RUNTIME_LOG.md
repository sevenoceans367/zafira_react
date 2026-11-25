# NAK-166 QA run log (continuation)

Date: 2026-11-25 (Asia/Calcutta)
PR #17 head under test: `489aeb32ebc2648caf87c1bd721978b0c4cc4b4e`
Browser: T3 server preview, authenticated local support account, URL `http://localhost:5177/internal-user/vc/ops/laytime?comid=4&page=1`, tab `tab_12_762fd270-0bf2-48d5-b501-c80d874c80b7`.

## Confirmed observations so far

- T3 preview is available and owned by this QA run. The earlier Chrome attach failure was not a blocker; T3 preview tools were used instead.
- Current rendered route identifies VCOUT, VOY 260003-1, POLYAIGOS. It shows five port tabs (LP-Singapore active, DP-Balongan, LP-Balongan, DP-Tanjung Pelepas, DP-Advario Terminal (Singapore) (SGP)).
- Sidebar was collapsed for this capture set. Viewports 1920x1080, 1536x960, 1440x900, 1280x800 and 1024x768 were rendered and saved. At each viewport, document width equals viewport width, both Save and Close Laytime are enabled and inside the viewport. DOM main scrollHeight exceeds clientHeight, confirming page content scrolls in the main pane. Summary/footer group is fixed at bottom; no document-level horizontal overflow measured.
- Main page initially displays cargo BALONGAN DECANT OIL; quantity 1; operator Christos Matarangas; charterer PERTAMINA INTERNATIONAL SHIPPING PTE LTD; blank terminal; Agent `—`; NOR tendered `31-02-2026 08:00` (red validation border); NOR accepted `11-10-2026 06:00`; Cargo commenced `11-10-2026 08:00`; Cargo completed `13-11-2026 08:00`; Laytime Starts blank; Laytime Ends `—`; DEMM Starts `—` (red label); All Clear `—`.
- Initial React page says 63 allowed hours, 0.0000 actual, 00.00 demurrage hours, $0.00. This does not match isolated clone allowance 108h; those are different data sources, so do not treat as parity evidence.
- Nego Dialogues is visibly disabled and explicitly says unavailable in production Laytime; this is correct for scope.
- Screenshot evidence captured (saved files are 1280x960 physical pixels while browser CSS viewport is requested logical size at DPR 1.25):
  - `viewport-1920x1080.png`
  - `viewport-1536x960.png`
  - `viewport-1440x900.png`
  - `viewport-1280x800.png`
  - `viewport-1024x768.png`

## Still outstanding

Test expanded sidebar at all required widths as feasible; top/middle/bottom page states; expanded/collapsed summary; interaction and input-validation draft sequence without Save; measure overlap with content and actions; compare supplied HTML plus SOF rendering; capture focused section screenshots; update consolidated report and PR comment. No business writes have been issued.

## Responsive scroll and design comparison

- The initial React desktop screenshot and supplied HTML have been rendered in the same T3 Chromium engine at 1536x960. The original HTML was served read-only from its attachment directory on temporary port 8788 because the standalone HTML preview expands recursively on `min-height:100vh`. No source files were edited. The original HTML reference file remains unchanged.
- Reference screenshots: `design-reference-top-1536x960.png`, `design-reference-activities-1536x960.png`. React screenshots: `react-activities-1536x960.png`, `summary-expanded-1536x960.png`, `summary-expanded-middle-1536x960.png`, `summary-expanded-bottom-1536x960.png`.
- The design HTML explicitly documents (v2/v3/v4) full-width/no-sidebar content, green Activities, orange Deductions, blue disabled Nego Dialogues section, C as default, HR inside metric fields, neutral gray/cream table headers, a floating compact summary pill, light SOF footer chrome, and gray-outline Close Laytime. Rendered React page matches the activity/deduction ribbon colors and floating summary behavior. React retains the shared two-rail shell, so its page content is narrower than the HTML design. React footer notice is muted gray; supplied prototype notice is orange/yellow (the user-required gray SOF-style footer is met).
- Summary expanded is a floating right-side card (not a full-width expanded bar). At 1536x960, with sidebar expanded, its card bounds are x=1062..1465, y=396..1063 nominal box; visible clipping within its parent means panel is constrained above footer. At bottom scroll, visible wrapper ends y=855 and Save/Close occupy y=882..919, leaving a 27px gap. At 1920x1080, collapsed pill y=951..995 and Save/Close y=1023..1060. No overlap with footer actions observed in top/middle/bottom captures.
- Inner table overflow sweep (positive overflow is horizontally scrollable `_tableWrap_1kits_2393`; document `scrollWidth` remained exactly viewport width):

| Viewport | Sidebar expanded: Activities / Deductions overflow | Sidebar collapsed: Activities / Deductions overflow |
|---|---:|---:|
| 1920x1080 | 0 / 0 px | 0 / 0 px |
| 1536x960 | 14 / 0 px | 0 / 0 px |
| 1440x900 | 110 / 21 px | 0 / 0 px |
| 1280x800 | 270 / 181 px | 110 / 21 px |
| 1024x768 | 526 / 437 px | 366 / 277 px |

The activity/deduction tables remain horizontally scrollable; narrow widths require horizontal movement to see all columns. The supplied HTML uses the full page width and does not have this shared-shell width constraint. This is a visible desktop parity limitation; do not conflate it with document-level overflow (none found).
- At 1536x960 and scroll-to-bottom with summary expanded, attachments section remained visible above the floating panel, and Save/Close remained in viewport and not covered. Middle capture shows Activities, Deductions, disabled Nego Dialogues, Remarks, and the compact summary/footer.

## New evidence artifacts

All screenshots are under `pr-assets/nak-166/independent-evidence/` on the orphan evidence branch. This log is updated incrementally; use it rather than repeating checked viewport/layout states after compaction.

## Port and keyboard evidence (26 Nov continuation)

- React port switching was exercised by clicking each tab; no Save, approval, close, file, or delete action was triggered. Rendered values:

| Port | Allowed (summary) | Activity 1 | Activity dates | Partial | Selected tab |
|---|---:|---|---|---:|---|
| LP-Singapore | 63 | blank | blank | blank | yes when restored |
| DP-Balongan | 72 | `Test` | 01-01-2026 12:00 to 01-01-2026 14:00 | 100 | confirmed |
| LP-Balongan | 108 | `to count` | 01-07-2026 00:00 to 02-07-2026 00:00 | 100 | confirmed |
| DP-Tanjung Pelepas | blank (`—`) | `QA Allowance Seed` | 01-05-2026 08:00 to 02-05-2026 08:00 | 100 | confirmed |
| DP-Advario Terminal (Singapore) (SGP) | blank (`—`) | blank | blank | blank | confirmed |

  DP-Balongan displayed 2.0000 actual hours. LP-Balongan displayed 24.0000 actual hours. DP-Tanjung Pelepas displayed 24.0000 actual hours with blank allowance. The header cargo/operator/charterer stayed `BALONGAN DECANT OIL` / `Christos Matarangas` / `PERTAMINA INTERNATIONAL SHIPPING PTE LTD` across tabs. Blank allowance displays as `—`; existing stored activity rows still contribute actual time. This is only the React page's rendered GET-backed data. The isolated clone's one LP row is insufficient to prove all-port SQL/API parity.
- On first load of LP-Singapore, NOR Tendered is `31-02-2026 08:00` with a red border but `aria-invalid` is absent. This invalid existing value did not crash initial page render; its allowance summary remained 63 and actual 0. It is not an acceptance of invalid date persistence.
- Keyboard Tab checks traversed breadcrumb links, Recent Activity, Notifications, Support, voyage link, Download PDF, Back, all five port tabs, quantity, terminal, and NOR/Cargo date inputs. Each stop observed `:focus-visible=true`. Editable activity/deduction inputs have individual `aria-label`s, and row insert/delete buttons have accessible names.
- Gaps found by DOM inspection (axe not yet run): expanded-summary controls include `Minimize summary` and `Send for Approval`; collapsed summary button has no explicit aria-label or `aria-expanded`. Remarks, activity/deduction Notes, and Approver search inputs have neither associated label nor `aria-label` (only placeholders). NOR Tendered's red invalid styling lacks `aria-invalid`/programmatic error text. Disabled Nego body text is `rgb(138,147,162)` over `rgb(247,248,250)`, contrast 2.92:1 (below 4.5:1); Nego title contrast is 5.63:1.
- Pressing Enter while a date text input had focus left focus at `BODY`; Escape then left focus at `BODY`. No form exists in the page and Save is `type=button`; this did not submit or trigger a write. Escape/focus restoration from an actually open picker or summary panel remains unverified.

## Draft validation sequence (26 Nov; no save)

Fresh route reload restored fixture state. On the blank DP-Advario call, entered allowance 72, demurrage USD 24,000/day, dispatch USD 12,000/day, activity `QA 10h`, 01-01-2026 00:00 to 01-01-2026 10:00, C100. Committing each custom date field with Enter produced raw/counting duration 10.0000h, actual 10.0000h, time to dispatch 62.0000h, dispatch USD 31,000.00, and no demurrage.

Changing LT Partial to 150 produced `aria-invalid=true`, “Calculations unavailable — fix invalid fields”, and dashes for all financial summary values; cumulative and deduction totals were not misleading zeros. The disabled duration remained the raw 10.0000h. Changing dispatch rate, toggling C/NC by Space, inserting an activity row, and confirming deletion of that inserted row all left the summary `— / Unavailable` while the invalid 150 draft was active. The delete control presents a confirmation dialog (“Are you sure you want to delete this entry permanently?”); the inserted draft row was removed after confirming. Restoring LT Partial to 100 restored 10.0000 actual, 62.0000 time to dispatch, and USD 31,000.00 dispatch. Captures: `lt-partial-150-unavailable-1536x960.png`, `lt-partial-100-recovered-1536x960.png`.

Save was not attempted: the current backend `.env` points at shared XAMPP DB port 3306, while the isolated clone is port 13417 and has no connected API. Save remained enabled during the invalid draft. Therefore the requested rejection behavior and SQL/reload persistence remain BLOCKED, not PASS. No business writes occurred. A page reload discarded the unsaved DP-Advario draft and restored LP-Singapore (63 allowed, 0 actual, original invalid NOR value).

## Axe audit evidence

Axe-core 4.10.3 was loaded for this local audit from a temporary external-to-repository file and run in the T3 browser on the live React Laytime page, default and expanded-summary states, WCAG 2.0/2.1/2.2 A/AA plus best-practice tags. Expanded state reported 52 passes, 1 incomplete rule group, and violations:

- `color-contrast`, serious: 22 nodes in expanded state; page nodes include Details subtitle 2.73:1, manual Port Name/Options labels 3.09:1, green Activities subheading/pagination 2.81:1, Activity table headers 2.99:1, summary subtitle 2.56:1, and HR tags 2.76–3.09:1. All are below the requested 4.5:1 normal-text threshold. Shared shell nodes include sidebar group labels 3.36:1, Recent Activity badge 3.11:1, and VCOUT badge 3.54:1.
- `label`, critical: two read-only disabled cumulative/net-duration inputs have no programmatic label (`input[value="63.0000"]`, `input[value="0.0000"]`).
- `empty-table-header`, minor: two row-action headers are blank (Activities and Deductions).
- `image-redundant-alt`, minor: ten shell navigation icons repeat the adjacent link text in `alt`.

Collapsed summary and initial snapshot also show `Calculations unavailable` when invalid, with summary values unavailable. Contrast could not be computed for several overlapping summary/footer labels; axe returned these as incomplete. This is a page-specific accessibility failure plus separately identified shared-shell findings.

## SOF and current regression evidence

The current React Tanker SOF route for COMID 4 rendered LP-Balongan selected and showed vessel POLYAIGOS, port Balongan / Indramayu-Balongan (IDN), voyage 260003-1, operation Loading, cargo BALONGAN DECANT OIL, berth Balongan SPM, five key operations shown, and existing attached PDF. This confirms the current React SOF screen/selection chrome and current route load only; it is not an actual Legacy PHP comparison. Screenshot: `react-sof-lp-balongan-1536x960.png`.

## Explicitly untested after recovery

Browser zoom (100/125/150/200) is not controllable through T3 preview's CSS viewport resize; Control-plus did not alter browser zoom. Full-page screenshots are not supported by the preview snapshot (saved screenshots are viewport-sized captures). No live axe run was possible on Legacy. Save/approval/attachment writes, direct API payload validation, API/SQL parity across ports, Gas/Dry COMID 8 regression, and reduced-motion behavior remain blocked or not tested as stated in the report.
