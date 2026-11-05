# VCIN Contract Finance layout

Approved: fixture type `4` (standalone VCIN) only.

## Behavior

- Same route as Spot Contract Finance (`OpsVcPaymentGridPage`).
- When `fixtureTypeId === 4`, render expense-only layout from `SOC_Contract_Finance_VCIN_Redesign_2.html`.
- Other fixture types unchanged (Income + Expenses + Hireage KPIs).

## UI

1. Header chip: `Contract Type · VOY … · Vessel` (neutral grey; shared VoyageOpsHeading pattern).
2. Tiles: Total Freight & Demurrage Expenses · Total Others · Total Contract Cost · Cost / Day.
3. Waterfall: Freight & Dem. vs Others (no Net/Hire).
4. Tables: Freight & Demurrage Expenses; Others (no Hireage card).
5. Labels: Paid (not Collected); Customer; Amount ($).

## Data

- API exposes `fixtureTypeId` and `totalDays` when available.
- Freight & Demurrage ← freight + demurrage sections.
- Others ← port-costs + ops-costs + bunkers (no hire).
