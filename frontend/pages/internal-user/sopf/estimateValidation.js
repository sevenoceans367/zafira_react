const ERROR_CLASS = 'estimate-field-error';

function filled(value) {
  return String(value ?? '').trim() !== '';
}

/**
 * PHP-style "don't add empty row until previous is filled" checks.
 * Returns an alert message, or null when add is allowed.
 */
export function getAddRowBlockMessage(collection, rows = [], { identify } = {}) {
  let list = Array.isArray(rows) ? rows : [];
  if (collection === 'consumptionRows' && identify) {
    list = list.filter((row) => row.identify === identify);
  }
  if (!list.length) return null;

  const last = list[list.length - 1] || {};
  const rules = {
    portLegs: {
      message: 'Please fill all the records for Sea Passage',
      ok: () => (
        filled(last.fromPortId)
        && filled(last.toPortId)
        && filled(last.passageType)
        && filled(last.speedType)
        && filled(last.distance)
      ),
    },
    cargoRows: {
      message: 'Please fill All details',
      ok: () => filled(last.cargoId),
    },
    overageCargoRows: {
      message: 'Please fill All details',
      ok: () => filled(last.cargoId),
    },
    deadfreightCargoRows: {
      message: 'Please fill All details',
      ok: () => filled(last.cargoId),
    },
    brokerRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.percent),
    },
    orcRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.costId) && filled(last.amount),
    },
    otherIncomeRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.description) && filled(last.amount),
    },
    bunkerRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerGradeId) && filled(last.qty) && filled(last.price),
    },
    bunkerActivityRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.activity) && filled(last.bunkerGrade) && filled(last.qty),
    },
    hireRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.hireFrom) && filled(last.hireTo),
    },
    profitSharingRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.vendorId) && filled(last.percentage),
    },
    consumptionRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerGradeId),
    },
    secaBunkerRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerGradeId) && filled(last.qty) && filled(last.price),
    },
    passageLocations: {
      message: 'Please fill previous data',
      ok: () => filled(last.fromLocation) && filled(last.toLocation),
    },
    freightQtyRows: {
      message: 'Please fill All details',
      ok: () => filled(last.vendorId) && filled(last.agreedGrossFreight) && filled(last.quantity),
    },
    tankerWsRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.freightSpecs) || filled(last.customerId) || filled(last.minCargoQty),
    },
    offHireRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.reason) || filled(last.from) || filled(last.to),
    },
    deliveryBunkerRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerGradeId) && filled(last.qty),
    },
    redeliveryBunkerRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.bunkerGradeId) && filled(last.qty),
    },
    invoiceRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.invoiceId),
    },
    disponentRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.name),
    },
    voyageEventRows: {
      message: 'Please fill previous data',
      ok: () => filled(last.details) || filled(last.eventDate),
    },
  };

  const rule = rules[collection];
  if (!rule) return null;
  return rule.ok() ? null : rule.message;
}

/**
 * Client-side estimate validation — mirrors PHP addestimate.php getValidate().
 * Returns `{ message, fieldId }` for the first failure, or null when valid.
 */
export function validateEstimateForm(form = {}) {
  if (!String(form.fixtureTypeId || '').trim()) {
    return { message: 'Please select Business Type', fieldId: 'fixtureTypeId' };
  }
  if (!String(form.vesselImoId || '').trim()) {
    return { message: 'Please select Vessel', fieldId: 'vesselName' };
  }
  if (!String(form.voyageNo || '').trim()) {
    return { message: 'Please fill Voyage No.', fieldId: 'voyageNo' };
  }

  const firstLeg = (form.portLegs || [])[0] || {};
  if (!String(firstLeg.fromPortId || '').trim()) {
    return { message: 'Please select From Port', fieldId: 'portFrom_0' };
  }
  if (!String(firstLeg.toPortId || '').trim()) {
    return { message: 'Please select To Port', fieldId: 'portTo_0' };
  }
  if (!String(firstLeg.passageType || '').trim()) {
    return { message: 'Please select Laden/Ballast', fieldId: 'portPassage_0' };
  }
  if (!String(firstLeg.speedType || '').trim()) {
    return { message: 'Please select Speed Type', fieldId: 'portSpeed_0' };
  }
  if (!String(firstLeg.distance ?? '').trim()) {
    return { message: 'Please fill Total Dist.', fieldId: 'portDistance_0' };
  }

  const hasCargo = (form.cargoRows || []).some((row) => String(row.cargoId || '').trim());
  if (!hasCargo) {
    return { message: 'Please fill Cargo Name', fieldId: 'cargoId_0' };
  }

  if (!String(form.charteringTeam || '').trim()) {
    return { message: 'Please select Chartering Team', fieldId: 'charteringTeam' };
  }
  if (!String(form.charteringPic || '').trim()) {
    return { message: 'Please select Chartering PIC', fieldId: 'charteringPic' };
  }

  return null;
}

function clearFieldError(el) {
  if (!el) return;
  el.classList.remove(ERROR_CLASS);
  el.closest?.('[data-estimate-field-wrap]')?.classList.remove(ERROR_CLASS);
}

function markFieldError(el) {
  if (!el) return;
  el.classList.add(ERROR_CLASS);
  const wrap = el.closest?.('[data-estimate-field-wrap]');
  if (wrap) wrap.classList.add(ERROR_CLASS);
}

/**
 * After alert dismiss: open parent panel if needed, highlight field, focus it.
 * Mirrors PHP jAlert callback → addClass('error') + focus().
 */
export function focusEstimateValidationField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return;

  document.querySelectorAll(`.${ERROR_CLASS}`).forEach((node) => {
    node.classList.remove(ERROR_CLASS);
  });

  const apply = () => {
    const el = document.getElementById(fieldId);
    if (!el) return false;

    const panel = el.closest('section');
    const toggle = panel?.querySelector('button[aria-expanded]');
    if (toggle?.getAttribute('aria-expanded') === 'false') {
      toggle.click();
      window.setTimeout(apply, 40);
      return true;
    }

    markFieldError(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus?.();
    }

    const clear = () => {
      clearFieldError(el);
      el.removeEventListener('blur', clear);
      el.removeEventListener('change', clear);
      el.removeEventListener('input', clear);
    };
    el.addEventListener('blur', clear, { once: true });
    el.addEventListener('change', clear, { once: true });
    el.addEventListener('input', clear, { once: true });
    return true;
  };

  window.requestAnimationFrame(() => {
    if (!apply()) {
      window.setTimeout(apply, 80);
    }
  });
}
