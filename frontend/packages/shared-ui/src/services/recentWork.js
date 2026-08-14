export async function fetchRecentWork() {
  const response = await fetch('/api/recent_work');
  if (!response.ok) {
    throw new Error('Failed to fetch recent activity.');
  }
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.recentWork)) return data.recentWork;
  return [];
}

export function notifyRecentWorkUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('recent-work-updated'));
}
