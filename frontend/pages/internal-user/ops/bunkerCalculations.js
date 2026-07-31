/** Port of PHP bunker_calculation.php getCalculate — simplified v1 rebuild. */

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round3(v) {
  return Number(num(v).toFixed(3));
}

/** effectivePrice = supplyPrice + (addCost/qtyStemmed if qty>0); stemmedValue = effective*qty */
export function recomputeRow(row = {}) {
  const qty = num(row.qtyStemmed);
  const supply = num(row.supplyPrice);
  const addCost = num(row.addCost);
  const addPerMt = qty > 0 ? addCost / qty : 0;
  const effectivePrice = round3(supply + addPerMt);
  const stemmedValue = round3(effectivePrice * qty);
  return {
    ...row,
    effectivePrice: effectivePrice.toFixed(3),
    stemmedValue: stemmedValue.toFixed(3),
  };
}

export function recomputeAllPortRows(ports = []) {
  return ports.map((port) => ({
    ...port,
    foRows: (port.foRows || []).map(recomputeRow),
    doRows: (port.doRows || []).map(recomputeRow),
  }));
}

function gradeName(lookups, side, bunkerId) {
  const list = side === 'fo' ? lookups?.foGrades : lookups?.doGrades;
  const found = (list || []).find((g) => String(g.id) === String(bunkerId));
  return found?.name || '';
}

function collectGradeIds(previousRows, ports, side) {
  const ids = new Set();
  for (const row of previousRows || []) {
    if (row?.bunkerId) ids.add(String(row.bunkerId));
  }
  for (const port of ports || []) {
    const rows = side === 'fo' ? port.foRows : port.doRows;
    for (const row of rows || []) {
      if (row?.bunkerId) ids.add(String(row.bunkerId));
    }
  }
  return [...ids];
}

function lastRobForGrade(ports, side, bunkerId) {
  const lastPort = (ports || [])[(ports || []).length - 1];
  if (!lastPort) return 0;
  const rows = side === 'fo' ? lastPort.foRows : lastPort.doRows;
  let rob = 0;
  for (const row of rows || []) {
    if (String(row.bunkerId) === String(bunkerId)) {
      rob = num(row.robSosp);
    }
  }
  return rob;
}

function rebuildSide(draft, side) {
  const previousRows = side === 'fo' ? draft.previousFo : draft.previousDo;
  const ports = draft.ports || [];
  const lookups = draft.lookups;
  const gradeIds = collectGradeIds(previousRows, ports, side);

  const sospResults = [];
  const consumedCharterer = [];
  const consumedOwner = [];

  for (const bunkerId of gradeIds) {
    const prev = (previousRows || []).find((r) => String(r.bunkerId) === String(bunkerId));
    const previousQty = num(prev?.qty);
    const previousValue = num(prev?.value);
    const name = prev?.name || gradeName(lookups, side, bunkerId) || `#${bunkerId}`;

    let sumStemQty = 0;
    let sumStemValue = 0;
    let ownerStemQty = 0;
    let ownerStemValue = 0;
    const calParts = [];

    for (const port of ports) {
      const rows = side === 'fo' ? port.foRows : port.doRows;
      for (const row of rows || []) {
        if (String(row.bunkerId) !== String(bunkerId)) continue;
        const qty = num(row.qtyStemmed);
        const value = num(row.stemmedValue);
        const price = num(row.effectivePrice);
        sumStemQty += qty;
        sumStemValue += value;
        if (qty > 0) calParts.push(`${round3(qty)}*${round3(price)}`);
        if (String(row.accountOf || '').toLowerCase() === 'owner') {
          ownerStemQty += qty;
          ownerStemValue += value;
        }
      }
    }

    const lastRob = lastRobForGrade(ports, side, bunkerId);
    const hasActivity = previousQty > 0 || previousValue > 0 || sumStemQty > 0 || lastRob > 0;
    if (!hasActivity) continue;

    const sospValue = round3(sumStemValue);
    sospResults.push({
      bunkerId,
      name,
      value: sospValue.toFixed(3),
      calDesc: calParts.join(','),
    });

    let consumedQty = Math.max(0, round3(previousQty + sumStemQty - lastRob));
    let consumedValue = round3(previousValue + sumStemValue - sospValue);

    const ownerQty = round3(ownerStemQty);
    const ownerValue = round3(ownerStemValue);
    if (ownerQty > 0 || ownerValue > 0) {
      consumedOwner.push({
        bunkerId,
        name,
        qty: ownerQty.toFixed(3),
        value: ownerValue.toFixed(3),
      });
      consumedQty = Math.max(0, round3(consumedQty - ownerQty));
      consumedValue = round3(consumedValue - ownerValue);
    }

    consumedCharterer.push({
      bunkerId,
      name,
      qty: consumedQty.toFixed(3),
      value: consumedValue.toFixed(3),
    });
  }

  return { sospResults, consumedCharterer, consumedOwner };
}

/**
 * Always recompute effective/stemmed on rows, then rebuild SOSP + consumed tables.
 */
export function recomputeBunkerForm(draft = {}) {
  const ports = recomputeAllPortRows(draft.ports || []);
  const next = { ...draft, ports };
  const fo = rebuildSide(next, 'fo');
  const diesel = rebuildSide(next, 'do');

  return {
    ...next,
    sospResults: { fo: fo.sospResults, do: diesel.sospResults },
    consumedCharterer: { fo: fo.consumedCharterer, do: diesel.consumedCharterer },
    consumedOwner: { fo: fo.consumedOwner, do: diesel.consumedOwner },
  };
}
