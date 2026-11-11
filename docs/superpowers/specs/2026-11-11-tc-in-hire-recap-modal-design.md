# TC In Hire Recap modal (Edit TC Recap)

Approved design for replacing the 4-step **TC Hire Details** popup with the full **Add / Edit TC In Hire Recap** form from `Add_TC_Recap_8.html` (Round 23+).

## Decisions

| Topic | Choice |
| --- | --- |
| Layout | Full form popup (not 4-step Hire Details) |
| Data | Full TC In Recap field set in the popup |
| Parent P&L | Keep **Final TC In Hireage** for Edit TC Recap Total Expenses; Gross Hire Expense is popup-only until a later cutover |
| Persistence | Full snapshot as JSON column; no new slave tables for Pre-TC / TC Expenses / voyage / docs |
| Approach | New `TcInHireRecapModal` + shared section pieces; keep slave2–4 hire/bunker/off-hire writes |

## UI

- Trigger: existing Edit TC Recap “TC In Recap” / Hire Details control (`tcInOpen`).
- Replace `TcInExpensesModal` with **`TcInHireRecapModal`**.
- Wide overlay (~1620px): header, scrollable LHS accordions, sticky RHS results, footer Cancel + Save.
- Title: **Add TC In Hire Recap** when empty/new; **Edit TC In Hire Recap** when a saved snapshot or hire rows exist. View mode: **View TC In Hire Recap** (inputs locked, Close only).

### LHS sections (order)

1. Recap Identifiers  
2. CP Information (Head Owners / Address)  
3. TC Details — TC Terms + Trip Schedule + Off Hire + “Add Period (Extension)”  
4. TC Expenses  
5. Vessel Particulars (Primary Data + Tanker Particulars; no Full Vessel Particulars link)  
6. Pre-TC Details (Itinerary + Expenses)  
7. Bunkers (Delivery / Redelivery)  
8. TC Terms for Voyage (Sea Passage + Port)  
9. Additional Info & Documents  

### Omitted in TC In UI

- Link Period Contract  
- Full Vessel Particulars link  
- Other Income  
- Sub-Charter Expense button  
- Off Hire Vendor  

### RHS results (popup only)

- Hire Expense: Total Hire Payable, Less Off-Hire, Net TC Days, Net Hire/Day, Net Hire Expense  
- Pre-TC Expenses: Total Pre-TC Expenses  
- TC Expenses: Total TC Expenses  
- Gross Hire Expense: Net Hire + Pre-TC + TC Expenses  

## Prefill (first open, no saved JSON)

Copy from parent TC Out (editable unless noted):

- Vessel, vessel type, vessel particulars (incl. Master’s Name)  
- TC Terms commercial fields (except Laycan and Brokerage Paid By — start blank)  
- Trip Schedule (incl. Hire $/day)  
- Off Hire, Bunkers, TC Terms for Voyage  

Blank:

- TC No., Est No., Laycan, Head Owners + full CP Info, Brokerage Paid By  
- TC Expenses, Pre-TC, Additional Info & Documents  

Fixed read-only:

- Contract Type = `TC In`  
- Business Type = parent business type  

If `TC_IN_RECAP_JSON` exists on load, hydrate from that snapshot instead of re-copying.

## Data model

Expand `form.tcInExpenses` into a TC In Recap object that includes:

- Identifiers, CP (head owners), terms, trip legs, off-hire, expenses, vessel particulars, pre-TC, bunkers, voyage terms, docs metadata, computed totals  
- Keep existing **hires / deliveryBunkers / redeliveryBunkers / offHires** (+ current adjustment fields) so `calcTcInFinalHireage` and slave2–4 mapping stay valid  

Trip Schedule legs map to `hires` (deliveryDate, redeliveryDate, voyageDays, dailyHire, hireage, commissions/CVE fields as applicable).

## Calcs

### Parent (unchanged this pass)

- `calcTcInFinalHireage(tcInExpenses)` continues to drive Final TC In Hireage on Edit TC Recap.  
- Built from hire / bunker / off-hire (+ existing adjustments: CVE off-hire, bunker on owner, ILOHC, AWRP, etc.).

### Popup RHS

- `calcTcInGrossHireExpense(tcInRecap)` (new):  
  - Total Hire Payable from trip schedule (+ Ballast Bonus / CVE / ILOHC per mockup wiring)  
  - Less Off-Hire from off-hire rows (+ nested bunkers when present)  
  - Net Hire Expense = Total Hire Payable − Less Off-Hire  
  - Net TC Days / Net Hire/Day guarded against ≤ 0 days  
  - Pre-TC and TC Expenses table totals  
  - Gross Hire Expense = Net Hire + Pre-TC + TC Expenses  
- Gross Hire does **not** replace parent Final Hireage in this pass.

### Periods

- UI supports “Add Period (Extension)”.  
- Parent Final Hireage and popup headline calcs use **Period 1** only until a later cutover.

### Bunkers

- Redelivery grade + qty mirror Delivery; only Redelivery price is editable.

## Components

- `frontend/pages/internal-user/tc/TcInHireRecapModal.jsx` (+ styles in `TcPages.module.css` or a dedicated module).  
- Shared presentational pieces where cheap (accordion card, field grid, bunker/off-hire rows).  
- Do not fork all of `TcFixtureFormPage`.  
- Move hireage helpers into `tcInRecapCalcs.js` (or keep exports on the new modal module): `calcTcInFinalHireage` for the parent, `calcTcInGrossHireExpense` for the RHS.  
- Wire: same `open` / `value` / `detail` / `lookups` / `readOnly` / `onClose` / `onApply` contract as today’s modal.  
- Remove or thin `TcInExpensesModal.jsx` once the new modal is wired (no dual entry points).

## Persistence

- Modal Save → `onApply` updates `form.tcInExpenses` only (draft stays with parent form).  
- Parent Recap Save:  
  1. Write hire / bunker / off-hire slices to `chartering_tc_estimate_slave2` / `slave3` / `slave4` as today.  
  2. Persist full TC In Recap JSON to new nullable column `TC_IN_RECAP_JSON` (`LONGTEXT`/`JSON`) on `chartering_estimate_tc_master` (include an `ALTER TABLE` migration in implementation).  
- Load: JSON present → hydrate `tcInExpenses` from JSON (authoritative for popup). JSON missing → rebuild from slave2–4 as today (legacy records).  
- No new slave tables for Pre-TC / TC Expenses / voyage terms / documents.

## Documents

- Dropzone stores filename / metadata in the JSON snapshot.  
- Live upload / download plumbing is out of scope for this pass.

## Out of scope

- Switching parent Total Expenses / P&L to Gross Hire Expense  
- New DB slave tables for non–hire/bunker/off-hire TC In sections  
- Full Add/Edit TC Recap page redesign (parent page)  
- Live file backend for Additional Info & Documents  
- Feeding extension periods into Final Hireage / Gross Hire engines  

## Testing

- Open modal on TC In/TC Out Edit Recap: layout matches mockup section order; RHS updates when trip/off-hire/expenses change.  
- First open prefills from parent; blanks match Section Prefill rules.  
- Save modal then parent Save: reload restores full JSON UI; slave2–4 still populate Final Hireage.  
- Legacy fixture with only slave2–4 (no JSON) still opens and shows hire/bunker/off-hire.  
- Read-only mode: no edits, no Save.  
- Parent Total Expenses still uses Final TC In Hireage (not Gross Hire).  
- Redelivery bunker qty locked to Delivery qty.  
