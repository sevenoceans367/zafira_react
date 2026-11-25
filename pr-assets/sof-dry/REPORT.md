# NAK-164 Dry SOF — evidence report

Fixture: Spot Ops Dry voyage **DRY001** / vessel **CRANE** / COMID **8** / FCAID **38** (local QA DB).

## Before (legacy Dry SOF)

- [before/01-in-ops-glance-dry.png](before/01-in-ops-glance-dry.png) — Dry in-ops glance with DRY001
- [before/02-sof-legacy-top.png](before/02-sof-legacy-top.png) — legacy Port Call + Key Operations (hose/tank presets, no Duration Days layout)

## After (redesigned Dry SOF)

- [after/01-sof-redesign-top.png](after/01-sof-redesign-top.png) — Identifiers (Terminal), Dry presets (22), OPERATION / single timestamp
- [after/02-sof-redesign-tables.png](after/02-sof-redesign-tables.png) — Activity + Deductions with **Duration (Days)**; LT columns omitted
- [after/03-sof-dp-kandla.png](after/03-sof-dp-kandla.png) — DP-Kandla port isolation (Discharging)

## Checks observed in browser

- Redesigned layout gates on Dry (`estimateType=3`); Tanker remains Hrs/Berth/LT UI.
- Key Operations: 22 Dry presets including FAOP; pagination `5 of 22`.
- Activity/Deductions: Duration (Days); no LT (C/NC), LT Partial %, Cumulative Days, Net Duration.
- Port tabs isolate LP/DP context (Singapore loading vs Kandla discharging).

## Automated

- Backend suite: pass (includes Dry preset length/order assertions).
- Frontend helpers suite: pass.
- Frontend production build: pass.
