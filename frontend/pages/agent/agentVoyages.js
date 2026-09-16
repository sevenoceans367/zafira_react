/** Status labels / helpers for Agent Portal dashboard. */

export const STATUS_LABEL = {
  notstarted: 'Not Started',
  draft: 'Draft Saved',
  submitted: 'Submitted',
  approved: 'Approved',
};

export function filterVoyages(voyages, filter) {
  if (filter === 'open-initial') {
    return voyages.filter((v) => v.initial === 'notstarted' || v.initial === 'draft');
  }
  if (filter === 'working-fda') {
    return voyages.filter((v) => v.fda === 'draft' || v.fda === 'submitted');
  }
  return voyages;
}

export function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function canOpenFda(voyage) {
  return voyage.initial === 'submitted' || voyage.initial === 'approved';
}
