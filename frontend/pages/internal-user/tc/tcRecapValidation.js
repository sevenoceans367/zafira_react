/** TC Recap (Add/Edit Time Charter) validation.
 * Add: mirrors php/addtcestimate.php $("#frm1").validate + getValidate().
 * Edit / TC In: also mirrors php/updatetcestimatecal.php required TC In dates.
 */

function filled(value) {
  return String(value ?? '').trim() !== '';
}

/** Match DmyDateInput / calc helpers — epoch placeholders are empty. */
function hasDateValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (/^0?1[-/]0?1[-/]1970\b/.test(raw) || /^1970[-/]0?1[-/]0?1\b/.test(raw)) return false;
  return true;
}

function firstHirePeriod(form = {}) {
  const rows = Array.isArray(form.hirePeriods) ? form.hirePeriods : [];
  return rows[0] || {};
}

function isSubCharterForm(form = {}) {
  return String(form.contractType || '').toLowerCase() === 'tcinout'
    || filled(form.periodId);
}

/**
 * Submit validation from PHP add/update TC estimate forms.
 *
 * @returns {{ message: string, fieldId: string } | null}
 */
export function validateTcRecapForm(form = {}) {
  // addtcestimate getValidate()
  if (!filled(form.vesselImoId)) {
    return { message: 'Please select Vessel', fieldId: 'vesselName' };
  }
  // addtcestimate rules
  if (!filled(form.tcNo)) {
    return { message: 'Please fill TC No.', fieldId: 'tcNo' };
  }

  if (!filled(form.charterer)) {
    return { message: 'Please select Charterers', fieldId: 'charterer' };
  }
  // PHP chartering_pic = Chartering Team
  if (!filled(form.charteringTeam)) {
    return { message: 'Please select Chartering Team', fieldId: 'charteringTeam' };
  }
  // PHP chartering_pic_1 = Chartering PIC 1
  if (!filled(form.charteringPic1)) {
    return { message: 'Please select Chartering PIC', fieldId: 'charteringPic1' };
  }
  if (!filled(form.delRangePort)) {
    return { message: 'Please fill Del Port/Range', fieldId: 'delRangePort' };
  }

  const hire = firstHirePeriod(form);
  // Trip schedule dates map to PHP txtDeliveryDate / txtReDeliveryDate on this form.
  const delDate = hire.delDate || form.delDate;
  const reDelDate = hire.reDelDate || form.reDelDate;
  // Hire rate maps to PHP txtHireFixPerUSD (saved back to hireFixPer on submit).
  const hireRate = hire.hireRate || form.hireFixPer;

  if (!hasDateValue(delDate)) {
    return { message: 'Please fill Delivery Date', fieldId: 'hireDelDate_0' };
  }
  if (!hasDateValue(reDelDate)) {
    return { message: 'Please fill Re-Delivery Date', fieldId: 'hireReDelDate_0' };
  }
  if (!hasDateValue(form.laycanFrom)) {
    return { message: 'Please fill Laycan From', fieldId: 'laycanFrom' };
  }
  if (!hasDateValue(form.laycanTo)) {
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

  // updatetcestimatecal.php: TC In delivery / redelivery required when TC In is active.
  // CVE amount is required in PHP but is computed from CVE/month × days (defaults to 0.00).
  if (isSubCharterForm(form)) {
    const tcHire = (form.tcInExpenses?.hires || [])[0] || {};
    if (!hasDateValue(tcHire.deliveryDate)) {
      return { message: 'Please fill TC In Date of Delivery', fieldId: 'tcInDeliveryDate_0' };
    }
    if (!hasDateValue(tcHire.redeliveryDate)) {
      return { message: 'Please fill TC In Date of Re-Delivery', fieldId: 'tcInRedeliveryDate_0' };
    }
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
      ok: () => filled(last.bunkerId) && filled(last.qty) && hasDateValue(last.bunkerDate) && filled(last.price),
    },
    redeliveryBunkers: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerId) && filled(last.qty) && hasDateValue(last.bunkerDate) && filled(last.price),
    },
    otherIncome: {
      message: 'Please fill previous data',
      ok: () => filled(last.description) && filled(last.amount),
    },
    otherExpenses: {
      message: 'Please fill previous data',
      // PHP: expense type + amount
      ok: () => filled(last.expenseTypeId) && filled(last.amount),
    },
    itineraryExpenses: {
      message: 'Please fill previous data',
      ok: () => (
        filled(last.expenseType)
        && (filled(last.expenseDescId) || filled(last.description))
        && filled(last.amount)
      ),
    },
    hirePeriods: {
      message: 'Please fill previous data',
      // PHP AddNewDelRedelRow: del + redel + hire rate
      ok: () => hasDateValue(last.delDate) && hasDateValue(last.reDelDate) && filled(last.hireRate),
    },
    offHires: {
      message: 'Please fill previous data',
      ok: () => hasDateValue(last.from) && hasDateValue(last.to),
    },
  };

  const rule = rules[collection];
  if (!rule) return null;
  return rule.ok() ? null : rule.message;
}
