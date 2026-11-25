# NAK-166 remediation validation (post senior review)

**Branch:** `feat/nak-166-laytime-tanker-layout`  
**DB:** `@@port=3306`, `root@localhost/zafira` (local XAMPP copy; clone `13307` unavailable)  
**Auth:** support / support@2025  
**Legacy pin:** `Zafira_legacy_pin` @ `93c44b4`

## Automated
- `node --test` FE+BE `laytimeTankerHelpers` + `laytimeTankerValidation` → **25 pass / 0 fail**

## API / SQL (COMID 4 Tanker, estimateType=2)
| Case | Result |
|---|---|
| Save LP activities with C/100 + NC/0 + deduction 50% | `msg=0`, `laytimeId=4` |
| SQL readback `laytime_slave` | `LT_C` / `LT_NC` / `LT_PARTIAL` preserved |
| SQL readback `laytime_slave1` | `LT_PARTIAL=50` preserved |
| Invalid LT Partial `150` | **400** — Activity LT Partial % 0–100 |
| Fresh DP missing NOR | **400** — Please fill the NOR TENDERED |
| Fresh DP Tanker save **without** `loadedRate` | **ok** `laytimeId=6`, slave LT flags stored |
| Charterer enrichment | `PERTAMINA INTERNATIONAL SHIPPING PTE LTD` |

## Formula / nego stance
- `recomputePortDraft` **unchanged**; fixture matrix in `LEGACY_TRUTH_TABLE.md` (A04–A07 / A09 / A12 = BLOCKED pending owner)
- Nego UI gated/disabled; FAB + summary show **Calculated Demurrage** only (`ttlDemurrage`)
- Tanker QTY edit does **not** `refreshAllowed` from qty/rate
- No new migrations / nego storage

## Browser
| Shot | Evidence |
|---|---|
| FAB Calc Demm | `after/03-remediation-top-calc-demm.png` |
| Expanded Calculated Demurrage | `after/04-remediation-summary-calculated.png` |
| Nego gated panel | `after/05-remediation-nego-gated.png` |
| DP-Balongan | `after/06-remediation-dp-balongan.png` |
| Dry COMID 8 regression (shared CSS / layout intact) | `after/07-dry-com8-regression.png` |
| Gray SOF footer + summary (no false Unsaved) | `after/08-remediation-footer-gray-summary.png` |

## Dry / Gas
- Dry COMID 8 (`ESTIMATE_TYPE=3`) — classic layout + Stowage Qty; no tanker FAB / C-NC table. Screenshot `07`.
- Gas (`ESTIMATE_TYPE=1`) — **no rows** in this local DB; charterer SQL path shared read-only and Dry read confirmed.

## CSS / a11y remediation notes
- Tanker styles scoped under `.ltTankerRoot` (no Dry `.cfInp` / `.ltNotesSm` leak)
- Footer note matches SOF Tanker gray `#f1f3f5` / `#5b6472`; instructional Submit/Close copy (not permanent Unsaved)
- Final demurrage label navy; `focus-visible` on sqBtn / search / C-NC toggle; dropzone click-outside uses `[data-attachment-dropzone]`

## Manual input QA (head 11167e4)
| Case | Result |
|---|---|
| Browser: type LT Partial `150` + Save | Alert: Activity #1 LT Partial % must be a number from 0 to 100. Field `aria-invalid` |
| API POST LT Partial `150` | **400** same message |
| API reverse activity dates | **400** finish must be on or after start |
| API demurrageRate `nope` | **400** Demurrage Rate must be blank or a valid number |
| API valid C100 + NC0 + ded 50% | **200** `laytimeId=4` |
| SQL readback | `QA C100 LT_C=1 LT_NC=0 LT_PARTIAL=100`; `QA NC 0/1/0`; ded `LT_PARTIAL=50` |
| Invalid inputs do not recompute demurrage | `mayRecomputeTankerField` gates FE; unit tests 26/26 |
