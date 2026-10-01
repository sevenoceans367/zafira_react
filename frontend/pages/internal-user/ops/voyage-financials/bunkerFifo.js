function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function classifyName(name) {
  const text = String(name || '').toUpperCase();
  if (text.includes('SCRUBBER') || text.includes('HSFO')) return 'HSFO';
  if (text.includes('LSMGO') || text.includes('MGO')) return 'LSMGO';
  if (text.includes('VLSFO')) return 'VLSFO';
  return '';
}

/**
 * FIFO bunker ledger for the voyage worksheet.
 * Oldest layer is consumed first: opening ROB brought forward, then stems in entry order.
 * Inline Amount stays consumed × reference price. This ledger is the layered cost.
 */
export function buildBunkerFifo({
  form,
  resolveGradeName,
  consumedByGrade = {},
  priceByGrade = {},
  summaryRows = [],
  vendorName = () => '',
}) {
  const firstLeg = (form.portLegs || [])[0] || {};
  const openingQty = {
    VLSFO: num(firstLeg.toRobFoArrival) || num(firstLeg.fromRobFoArrival),
    LSMGO: num(firstLeg.toRobDoArrival) || num(firstLeg.fromRobDoArrival),
    HSFO: 0,
  };
  const stems = (form.bunkerRows || []).filter(
    (row) => String(row.identify || '').toUpperCase() === 'SUPPLY',
  );
  const summaryByGrade = Object.fromEntries((summaryRows || []).map((row) => [row.grade, row]));

  return ['VLSFO', 'LSMGO', 'HSFO'].map((grade) => {
    const summary = summaryByGrade[grade] || {};
    const layers = [];
    if (openingQty[grade] > 0) {
      layers.push({
        grade,
        source: 'Opening B/F',
        carried: true,
        date: '',
        port: '',
        vendor: '',
        qty: round2(openingQty[grade]),
        price: num(priceByGrade[grade]) || num(summary.price),
        extra: '',
      });
    }
    stems.forEach((row) => {
      const key = classifyName(resolveGradeName(row.bunkerGradeId));
      if (key !== grade || !(num(row.qty) > 0)) return;
      layers.push({
        grade,
        source: 'Stem',
        carried: false,
        date: '',
        port: row.portName || '',
        vendor: vendorName(row.vendorId),
        qty: round2(num(row.qty)),
        price: num(row.price) || num(summary.price),
        extra: '',
        amount: round2(num(row.qty) * (num(row.price) || num(summary.price))),
      });
    });

    const summaryQty = num(summary.actualQty) || num(summary.qty);
    if (!layers.length && (summaryQty > 0 || num(summary.price) > 0 || num(summary.consumed) > 0)) {
      const qty = summaryQty || num(summary.consumed);
      layers.push({
        grade,
        source: summaryQty && num(summary.actualQty) ? 'Estimated' : 'Worksheet',
        carried: false,
        date: '',
        port: '',
        vendor: '',
        qty: round2(qty),
        price: num(summary.price) || num(priceByGrade[grade]),
        extra: '',
      });
    }

    const consumed = num(consumedByGrade[grade]) || num(summary.consumed);
    let leftToConsume = consumed;
    const consumedParts = [];
    const remaining = layers.map((layer) => ({ ...layer, left: layer.qty }));
    remaining.forEach((layer) => {
      if (!(leftToConsume > 0) || !(layer.left > 0)) return;
      const take = Math.min(layer.left, leftToConsume);
      layer.left = round2(layer.left - take);
      leftToConsume = round2(leftToConsume - take);
      consumedParts.push({
        qty: round2(take),
        price: layer.price,
        cost: round2(take * layer.price),
      });
    });

    const consumedCost = round2(consumedParts.reduce((sum, part) => sum + part.cost, 0));
    const available = round2(layers.reduce((sum, layer) => sum + layer.qty, 0));
    const remainingQty = round2(remaining.reduce((sum, layer) => sum + layer.left, 0));
    const remainingCost = round2(remaining.reduce((sum, layer) => sum + layer.left * layer.price, 0));
    const openingSub = layers[0]?.carried ? `${layers[0].qty.toFixed(2)} b/f` : '';
    const stemSub = layers.filter((layer) => !layer.carried).reduce((sum, layer) => sum + layer.qty, 0);
    return {
      grade,
      layers,
      consumedParts,
      consumed,
      consumedCost,
      available,
      remainingQty,
      remainingCost,
      availableNote: [openingSub, stemSub ? `${round2(stemSub).toFixed(2)} stemmed` : ''].filter(Boolean).join(' + '),
      consumedNote: consumedParts
        .map((part) => `${part.qty.toFixed(2)} @ ${part.price.toFixed(2)}`)
        .join(' + '),
    };
  }).filter((row) => row.layers.length || row.consumed > 0);
}

export function fifoGrandTotal(grades) {
  return round2((grades || []).reduce((sum, grade) => sum + num(grade.consumedCost), 0));
}

export function allocateConsumedCost(cost, mode, ownerValue, consumedQty) {
  const total = num(cost);
  if (mode === 'qty') {
    const ownerQty = Math.max(0, num(ownerValue));
    const qty = num(consumedQty);
    const owner = qty > 0 ? round2(total * (ownerQty / qty)) : 0;
    return { owner, charterer: round2(total - owner) };
  }
  const pct = Math.max(0, num(ownerValue));
  const owner = round2(total * (pct / 100));
  return { owner, charterer: round2(total - owner) };
}

export function formatFifoMoney(value) {
  return round2(num(value)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
