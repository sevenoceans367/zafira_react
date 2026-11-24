# Payment / Invoice Grid redesign — visual evidence

Baseline captured 2026-11-24 from live Contract Finance page (`/internal-user/vc/ops/payment-grid?comid=4&page=1`, vessel POLYAIGOS / VOY 260003-1) against `SOC_Payment_Invoice_Grid_Redesign.html`.

## before/ (current main)
| File | What |
| --- | --- |
| 01-top-kpis-waterfall.png | Header, KPI tiles, waterfall, Income table start |
| 02-income-expenses-scrolled.png | Income rows + Expenses card |
| 03-expenses-bottom.png | Expenses bottom (page scroll max) |

## mockup/ (target HTML)
| File | What |
| --- | --- |
| 01-top-freight-demurrage.png | Banner notes + cards 1–2 |
| 02-mid-ops-port.png | Cards 3–6 (Other Income … Port Costs) |
| 03-bottom-hireage.png | Port Costs Payment pills + Hireage |
| SOC_Payment_Invoice_Grid_Redesign.html | Source mockup |

Scroll note: live page scrolls inside `<main>` (~1370px). Mockup scrolls on `window` (~2040px).
