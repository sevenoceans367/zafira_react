export const STATUS_VARIANTS = ['success', 'warning', 'neutral', 'info', 'primary'];

export function resolveTicketStatusVariant(label) {
  switch (String(label || '').toUpperCase()) {
    case 'OPEN':
      return 'success';
    case 'WIP':
      return 'warning';
    case 'CLOSED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function resolveWorkflowStatusVariant(label) {
  const text = String(label || '').toLowerCase();
  if (!text) return 'neutral';
  if (text.includes('approved')) return 'success';
  if (text.includes('pending')) return 'warning';
  if (text.includes('review')) return 'info';
  if (text.includes('submit')) return 'neutral';
  return 'info';
}

export function resolveContractStatusVariant(isOpen) {
  return isOpen ? 'info' : 'success';
}

export function resolveMasterStatusVariant(label) {
  const text = String(label || '').toLowerCase();
  if (text.includes('in-active') || text.includes('inactive')) {
    return 'neutral';
  }
  if (text.includes('active')) {
    return 'success';
  }
  return 'neutral';
}

export function resolveFixtureStatusVariant(label) {
  const text = String(label || '').toLowerCase();
  if (text.includes('finalised') || text.includes('finalized')) {
    return 'success';
  }
  if (text.includes('not fixed') || text.includes('not finalised')) {
    return 'warning';
  }
  return 'neutral';
}
