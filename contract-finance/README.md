# Contract Finance redesign evidence (baseline)

Trello: https://trello.com/c/J1MObCE3  
Feature branch: `feat/contract-finance-redesign-r6`  
Fixture used for live screenshots: COMID `7` / VCOUT / VOY `26007` / POLYAIGOS (agent MariaDB clone port 13417)

## Screenshots

| File | What it shows |
| --- | --- |
| `01-baseline-top-highlights-waterfall-income.png` | **Live** top: header chip, 4 KPI tiles, waterfall, Income table start |
| `02-baseline-income-expenses.png` | **Live** scrolled: Income lower rows + Expenses (Hire folded in) |
| `03-mockup-top-highlights-waterfall-income.png` | **Mockup R7** top: KPI tiles with OUTSTANDING/DUE SOON/PROVISIONAL footers, waterfall, Income |
| `mockup-preview.html` | Viewport-safe slim of Round 6/7 HTML (font base64 stripped) |

Notes extract: `docs/mockups/SOC_Contract_Finance_Redesign_6_NOTES.md` on the feature branch.

## Reviewer takeaway

Live already has Round 6/7 tile chrome + waterfall + Income/Expenses. Biggest intentional deltas to decide: KPI status footers (mockup yes / Slack+live no) and separate Hireage card (mockup yes / live folds into Expenses).
