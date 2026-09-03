/** TC Recap (Add/Edit Time Charter) validation — mirrors php/addtcestimate.php. */

function filled(value) {
  return String(value ?? '').trim() !== '';
}

function firstHirePeriod(form = {}) {
  const rows = Array.isArray(form.hirePeriods) ? form.hirePeriods : [];
  return rows[0] || {};
}

function firstBunker(form = {}, key) {
  const rows = Array.isArray(form[key]) ? form[key] : [];
  return rows[0] || {};
}

/**
 * Submit validation from addtcestimate.php:
 * - getValidate(): Vessel
 * - $("#frm1").validate({ rules: … }): remaining required fields
 *
 * @returns {{ message: string, fieldId: string } | null}
 */
export function validateTcRecapForm(form = {}) {
  if (!filled(form.vesselImoId)) {
    return { message: 'Please select Vessel', fieldId: 'vesselName' };
  }
  if (!filled(form.tcNo)) {
    return { message: 'Please fill TC No.', fieldId: 'tcNo' };
  }

  const delBunker = firstBunker(form, 'deliveryBunkers');
  if (!filled(delBunker.bunkerId)) {
    return { message: 'Please select Delivery Bunker Grade', fieldId: 'delBunker_0' };
  }
  if (!filled(delBunker.qty)) {
    return { message: 'Please fill Delivery Bunker Qty', fieldId: 'delBunkerQty_0' };
  }
  if (!filled(delBunker.bunkerDate)) {
    return { message: 'Please fill Delivery Bunker Date', fieldId: 'delBunkerDate_0' };
  }
  if (!filled(delBunker.price)) {
    return { message: 'Please fill Delivery Bunker Price', fieldId: 'delBunkerPrice_0' };
  }

  const reDelBunker = firstBunker(form, 'redeliveryBunkers');
  if (!filled(reDelBunker.bunkerId)) {
    return { message: 'Please select Re-Delivery Bunker Grade', fieldId: 'reDelBunker_0' };
  }
  if (!filled(reDelBunker.qty)) {
    return { message: 'Please fill Re-Delivery Bunker Qty', fieldId: 'reDelBunkerQty_0' };
  }
  if (!filled(reDelBunker.bunkerDate)) {
    return { message: 'Please fill Re-Delivery Bunker Date', fieldId: 'reDelBunkerDate_0' };
  }
  if (!filled(reDelBunker.price)) {
    return { message: 'Please fill Re-Delivery Bunker Price', fieldId: 'reDelBunkerPrice_0' };
  }

  if (!filled(form.charterer)) {
    return { message: 'Please select Charterers', fieldId: 'charterer' };
  }
  if (!filled(form.charteringTeam)) {
    return { message: 'Please select Chartering Team', fieldId: 'charteringTeam' };
  }
  if (!filled(form.charteringPic1)) {
    return { message: 'Please select Chartering PIC', fieldId: 'charteringPic1' };
  }
  if (!filled(form.delRangePort)) {
    return { message: 'Please fill Del Port/Range', fieldId: 'delRangePort' };
  }

  const hire = firstHirePeriod(form);
  const delDate = hire.delDate || form.delDate;
  const reDelDate = hire.reDelDate || form.reDelDate;
  const hireRate = hire.hireRate || form.hireFixPer;

  if (!filled(delDate)) {
    return { message: 'Please fill Delivery Date', fieldId: 'hireDelDate_0' };
  }
  if (!filled(reDelDate)) {
    return { message: 'Please fill Re-Delivery Date', fieldId: 'hireReDelDate_0' };
  }
  if (!filled(form.laycanFrom)) {
    return { message: 'Please fill Laycan From', fieldId: 'laycanFrom' };
  }
  if (!filled(form.laycanTo)) {
    return { message: 'Please fill Laycan To', fieldId: 'laycanTo' };
  }
  if (!filled(form.reDelRange)) {
    return { message: 'Please fill Re-Del Port/Range', fieldId: 'reDelRange' };
  }
  if (!filled(form.exchangeCurrency)) {
    return { message: 'Please select Hire Currency', fieldId: 'exchangeCurrency' };
  }
  if (!filled(form.ilohcUsd)) {
    return { message: 'Please fill ILOHC', fieldId: 'ilohcUsd' };
  }
  if (!filled(hireRate)) {
    return { message: 'Please fill Hire ($/day)', fieldId: 'hireRate_0' };
  }
  if (!filled(form.broCommPayable)) {
    return { message: 'Please select Brokerage Paid By', fieldId: 'broCommPayable' };
  }

  return null;
}

/**
 * PHP-style "Please fill previous data" before adding another row.
 * @returns {string | null} alert message, or null when add is allowed
 */
export function getTcAddRowBlockMessage(collection, rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;

  const last = list[list.length - 1] || {};
  const rules = {
    deliveryBunkers: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerId) && filled(last.qty) && filled(last.bunkerDate) && filled(last.price),
    },
    redeliveryBunkers: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerId) && filled(last.qty) && filled(last.bunkerDate) && filled(last.price),
    },
    otherExpenses: {
      message: 'Please fill previous data',
      ok: () => (filled(last.expenseTypeId) || filled(last.description)) && filled(last.amount),
    },
    itineraryExpenses: {
      message: 'Please fill previous data',
      ok: () => filled(last.expenseType) && filled(last.amount),
    },
    hirePeriods: {
      message: 'Please fill previous data',
      ok: () => filled(last.delDate) && filled(last.hireRate),
    },
    offHires: {
      message: 'Please fill previous data',
      ok: () => filled(last.from) && filled(last.to),
    },
  };

  const rule = rules[collection];
  if (!rule) return null;
  return rule.ok() ? null : rule.message;
}
