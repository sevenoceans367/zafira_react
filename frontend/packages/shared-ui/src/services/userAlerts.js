export async function fetchUserAlerts() {
  const response = await fetch('/api/alerts');
  if (!response.ok) {
    throw new Error('Failed to fetch notifications.');
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return { alerts: data, holds: [] };
  }
  return {
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    holds: Array.isArray(data.holds) ? data.holds : [],
  };
}

export async function dismissUserAlert(alertId) {
  if (!alertId) return;
  await fetch(`/api/alerts/${encodeURIComponent(alertId)}/read`, { method: 'POST' }).catch(() => undefined);
}
