export async function fetchUserAlerts() {
  const response = await fetch('/api/alerts');
  if (!response.ok) {
    throw new Error('Failed to fetch notifications.');
  }
  return response.json();
}
