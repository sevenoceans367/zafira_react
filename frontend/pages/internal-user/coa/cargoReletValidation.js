/**
 * Client-side cargo relet validation — mirrors php/addcoacargorelet.php
 * jQuery validate rules + fields marked class="required".
 * Returns `{ message, fieldId, tab }` for the first failure, or null when valid.
 */

const ERROR_CLASS = 'coa-relet-field-error';

function filled(value) {
  return String(value ?? '').trim() !== '';
}

function firstPartyIssue(rows, side, fieldPrefix) {
  const row = (rows || [])[0] || {};
  if (!filled(row.charterer)) {
    return {
      message: `Please select Charterer (${side})`,
      fieldId: `${fieldPrefix}-charterer`,
    };
  }
  if (!filled(row.owner)) {
    return {
      message: `Please select Owner (${side})`,
      fieldId: `${fieldPrefix}-owner`,
    };
  }
  if (!filled(row.broker)) {
    return {
      message: `Please select Broker (${side})`,
      fieldId: `${fieldPrefix}-broker`,
    };
  }
  return null;
}

function firstPortIssue(rows, label, fieldPrefix) {
  const row = (rows || [])[0] || {};
  if (!filled(row.portId)) {
    return {
      message: `Please select ${label}`,
      fieldId: `${fieldPrefix}-port`,
    };
  }
  if (!filled(row.comments)) {
    return {
      message: `Please fill ${label} Comments`,
      fieldId: `${fieldPrefix}-comments`,
    };
  }
  return null;
}

export function validateCargoReletForm(form = {}) {
  if (!filled(form.coaId)) {
    return { message: 'Please select a COA', fieldId: 'coaId', tab: 'estimate' };
  }
  if (!filled(form.vesselImoId)) {
    return { message: 'Please select Vessel', fieldId: 'vesselImoId', tab: 'estimate' };
  }
  if (!filled(form.transDate)) {
    return { message: 'Please fill Date', fieldId: 'transDate', tab: 'estimate' };
  }
  if (!filled(form.reletNo)) {
    return { message: 'Please fill Cargo Relet No.', fieldId: 'reletNo', tab: 'estimate' };
  }
  if (!filled(form.cargoQty)) {
    return { message: 'Please fill Cargo Qty (MT)', fieldId: 'cargoQty', tab: 'estimate' };
  }

  const partiesIn = firstPartyIssue(form.partiesIn, 'IN', 'partiesIn-0');
  if (partiesIn) return { ...partiesIn, tab: 'estimate' };

  const loadIn = firstPortIssue(form.loadPortsIn, 'Load Port (IN)', 'loadPortsIn-0');
  if (loadIn) return { ...loadIn, tab: 'estimate' };

  const disIn = firstPortIssue(form.dischargePortsIn, 'Dis Port (IN)', 'dischargePortsIn-0');
  if (disIn) return { ...disIn, tab: 'estimate' };

  const partiesOut = firstPartyIssue(form.partiesOut, 'OUT', 'partiesOut-0');
  if (partiesOut) return { ...partiesOut, tab: 'estimate' };

  const loadOut = firstPortIssue(form.loadPortsOut, 'Load Port (OUT)', 'loadPortsOut-0');
  if (loadOut) return { ...loadOut, tab: 'estimate' };

  const disOut = firstPortIssue(form.dischargePortsOut, 'Dis Port (OUT)', 'dischargePortsOut-0');
  if (disOut) return { ...disOut, tab: 'estimate' };

  if (!filled(form.freightUsdOut)) {
    return {
      message: 'Please fill Freight Out ($/MT)',
      fieldId: 'freightUsdOut',
      tab: 'estimate',
    };
  }

  return null;
}

function clearFieldError(el) {
  if (!el) return;
  el.classList.remove(ERROR_CLASS);
  el.closest?.('[data-relet-field-wrap]')?.classList.remove(ERROR_CLASS);
}

function markFieldError(el) {
  if (!el) return;
  el.classList.add(ERROR_CLASS);
  el.closest?.('[data-relet-field-wrap]')?.classList.add(ERROR_CLASS);
}

/** Highlight + focus the invalid control (PHP jQuery validate style). */
export function focusCargoReletValidationField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return;

  document.querySelectorAll(`.${ERROR_CLASS}`).forEach((node) => {
    node.classList.remove(ERROR_CLASS);
  });

  const apply = () => {
    const el = document.getElementById(fieldId);
    if (!el) return false;

    markFieldError(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const focusTarget = el.matches('input, select, textarea, button')
      ? el
      : el.querySelector('input, select, textarea, button');
    try {
      (focusTarget || el).focus?.({ preventScroll: true });
    } catch {
      (focusTarget || el).focus?.();
    }

    const clear = () => {
      clearFieldError(el);
      el.removeEventListener('blur', clear);
      el.removeEventListener('change', clear);
      el.removeEventListener('input', clear);
      focusTarget?.removeEventListener('blur', clear);
      focusTarget?.removeEventListener('change', clear);
      focusTarget?.removeEventListener('input', clear);
    };
    el.addEventListener('blur', clear, { once: true });
    el.addEventListener('change', clear, { once: true });
    el.addEventListener('input', clear, { once: true });
    focusTarget?.addEventListener('blur', clear, { once: true });
    focusTarget?.addEventListener('change', clear, { once: true });
    focusTarget?.addEventListener('input', clear, { once: true });
    return true;
  };

  window.requestAnimationFrame(() => {
    if (!apply()) window.setTimeout(apply, 80);
  });
}
