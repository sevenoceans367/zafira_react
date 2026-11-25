# NAK-164 Dry SOF — evidence report

Fixture: Spot Ops Dry voyage **DRY001** / vessel **CRANE** / COMID **8** / FCAID **38** (local QA DB).

Production head reviewed after senior-review fixes: `e59c9bc676f88450e998437f7eef0a46fbe8c7a3`

## Before (legacy Dry SOF)

- [before/01-in-ops-glance-dry.png](before/01-in-ops-glance-dry.png) — Dry in-ops glance with DRY001
- [before/02-sof-legacy-top.png](before/02-sof-legacy-top.png) — legacy Port Call + Key Operations (hose/tank presets, no Duration Days layout)

## After (redesigned Dry SOF)

- [after/01-sof-redesign-top.png](after/01-sof-redesign-top.png) — Identifiers (Terminal), Dry presets (22), OPERATION / single timestamp
- [after/02-sof-redesign-tables.png](after/02-sof-redesign-tables.png) — Activity + Deductions with **Duration (Days)**; LT columns omitted (pre-CSS-widen capture; Duration header wrap fixed in `e59c9bc`)
- [after/03-sof-dp-kandla.png](after/03-sof-dp-kandla.png) — DP-Kandla port isolation (Discharging)

## Senior-review fixes (`e59c9bc`)

1. Dry activity hours stored at 4dp (Tanker remains 1dp) so short intervals survive Days display.
2. Master Pilot fallback applies once; timed arrival Pilot does not fabricate a second Pilot timestamp.
3. Completed reversed Activity/Deduction ranges rejected on FE save + BE; incomplete drafts allowed.
4. Draft F/A Identifiers: freight worksheet has ROB only; F/A uses established SOF cargo Arrival/Departure draft rows (documented).
5. Key-ops load is non-destructive for saved history; empty SOFs seed 22 Dry presets; `SLAVEID` tie-break for stable order.
6. Dry-scoped table CSS widens Duration (Days) so headers no longer collide with Notes.
7. Removed unused FE `DEFAULT_KEY_OPERATIONS_DRY` (backend owns presets).

## Automated

```text
# backend
npm test -- --test-name-pattern="sofDb|sofService|Dry|Pilot|reversed|draft"
# → 66/66 pass

# frontend
npm test -- --run pages/internal-user/ops/sofTankerHelpers.test.js
# → 88/88 pass (includes Dry 4dp + reversed-interval tests)
```

## Notes

- Orphan branch only — never merge into main.
- Follow-up populated persistence screenshots (save/reload, both Pilots, FAOP, attachments) still recommended for acceptance beyond code+unit coverage.
