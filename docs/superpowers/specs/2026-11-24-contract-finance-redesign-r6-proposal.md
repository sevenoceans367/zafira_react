# Contract Finance Redesign R6/R7 — proposal (pending approval)

Trello: [J1MObCE3](https://trello.com/c/J1MObCE3)  
Mockup: `SOC_Contract_Finance_Redesign_6` (local attachment + notes extract)  
Baseline evidence: orphaned branch `pr-assets/contract-finance-redesign`

## Verdict

**Most of Rounds 4–7 is already live** on `OpsVcPaymentGridPage` against real COMID data. The remaining work is a narrow polish / alignment pass, not a greenfield redesign — unless we intentionally reintroduce elements Slack asked to drop.

## Baseline fixture

- DB: agent MariaDB clone `127.0.0.1:13417` / `zafira` (not main `3306`)
- Voyage: COMID `7`, VCOUT, VOY `26007`, POLYAIGOS
- Screens: `01-baseline-top-…png`, `02-baseline-income-expenses.png`

## Visual deltas (mockup vs current)

| Area | Mockup (R6/R7) | Current live | Gap |
| --- | --- | --- | --- |
| KPI tiles | Cashflow-style gradient icon badge, large value, formula sub, **dash + small-caps status footer** (`OUTSTANDING` / `DUE SOON` / `PROVISIONAL`) | Same card chrome + icon badge; subtitles are **line counts / formula**; **no status footers** | Footer text only — and Slack previously asked to **remove** those footers |
| Header identity | Spot-coloured chip `VOY · vessel` | Contract-type chip `VCOUT · VOY · vessel` + working **Go to Voyage Cashflow** | Mostly done; colour-by-contract-type may need polish |
| Waterfall | Segmented Income / Expenses+Hire / Net; click → scroll/highlight | Implemented (`WaterfallCard` + `flashKey`) | Likely done; verify hover labels match mockup |
| Sections | **Income / Expenses / Hireage** (3 cards) | **Income / Expenses** only; Hire is first expense row + KPI inclusion | Structural: mockup still shows Hireage card |
| Actions | Create / Edit / Completed by document state | `Initial · Edit` / `Final · Create` / muted Completed via `restyleActionLabel` | Label copy / tone polish |
| Columns | Net Amount, Status, Date Paid on expenses | Present | Done |
| Section totals | Collected/Outstanding, Paid/Outstanding chips | Present | Done |
| VCIN twin | Same chrome, expense-only content | Separate VCIN path already | Keep parity if touching tiles |

## Blast radius

| Layer | Files / surfaces |
| --- | --- |
| UI | `OpsVcPaymentGridPage.jsx`, `OpsVcPaymentGridPage.module.css`, `OpsVcPaymentGridHeaderActions.jsx`, `VoyageOpsHeading.jsx` |
| Model | `opsVcPaymentGridModel.js` (KPIs, waterfall, status, action labels, VCIN grouping) |
| API | `paymentGridVcDb.js` / `paymentGridVcService.js` — only if new metrics need fields (e.g. voyage days for TCE) |
| Twin | VCIN expense-only layout on same page (`fixtureTypeId === 4`) |
| Out of page | Hire Statement page, Cost Payment Creation page — **out of scope** per mockup banner |

## New introductions map

| Item | Kind | Status |
| --- | --- | --- |
| KPI tiles (Income / Expenses / Net / TCE) | Metrics UI | **Already live**; TCE uses `totalDays` when API provides it |
| Waterfall + click-to-row | Chart / interaction | **Already live** |
| Create/Edit/Completed buttons | Functionality labels on existing actions | **Mostly live**; do not break `migrated` / href gates |
| Go to Voyage Cashflow | Navigation | **Live** (linked to SOA / cashflow route) |
| Tile status footers Outstanding/Due Soon/Provisional | Cosmetic metric labels | Mockup has them; Slack said remove; **live already omits** |
| Separate Hireage card | Layout | Mockup has it; live folds Hire into Expenses |

## Deferred / removed / out of scope

- Hire Statement Creation page redesign — deferred in mockup notes
- Cost Payment Creation linked HTML — separate template; not this PR
- Owners Side brokerage row — already omitted in model
- Re-adding tile status footers — **do not**, unless you override Slack
- Main Zafira DB (`3306`) — never touch for this work

## Functionality-preservation plan

1. Keep all existing action `href` / `enabled` / `migrated` gates unchanged.
2. Any tile/footer CSS changes stay presentational — no new payment APIs.
3. Preserve VCIN branch (`groupPaymentGridSectionsVcIn`) chrome parity.
4. Do not rename routes or query params (`comid`, `page`, `voyage_no`).
5. Regression: open Spot + VCIN grids, click Initial/Final/Payment/Statement where enabled, confirm Back + Cashflow links.

## Approaches

**A — Close-the-gap polish (recommended)**  
Treat card as mostly done. Confirm Slack wins on tile footers (keep omitted). Optionally restore a visual Hireage card *or* document that folding Hire into Expenses is intentional Round 6 behaviour. Small CSS/copy fixes only; after-screenshots on evidence branch.

**B — Pixel-match Round 7 HTML**  
Re-add Outstanding/Due Soon/Provisional tile footers and a separate Hireage card to match HTML literally. Conflicts with Slack; larger UX churn for little functional gain.

**C — Full visual rewrite of tiles/tables**  
Rebuild chrome from scratch. High blast radius, unnecessary given live parity.

**Recommendation: A.**

## Clarifying questions (block implementation)

1. **Tile footers:** Keep live (no Outstanding/Due Soon/Provisional on KPIs) per Slack, or force Round 7 mockup footers?
2. **Hireage:** Keep Hire inside Expenses (current), or restore a third Hireage card as in the HTML?
3. Scope of this PR: polish-only, or any new metric data work (e.g. voyage-days source quality for TCE)?
