export async function fetchRecentWork() {
  const response = await fetch('/api/recent_work');
  if (!response.ok) {
    throw new Error('Failed to fetch recent activity.');
  }
  return response.json();
}
