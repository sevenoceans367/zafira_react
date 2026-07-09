const BASE = '/api/internal-user/sopf';

export async function fetchVesselsWithinRange({ lat, lng, radius, navstatus }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
  });

  if (navstatus?.length) {
    params.set('navstatus', navstatus.join(','));
  }

  const response = await fetch(`${BASE}/vessel_positions/within_range?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Failed to load vessels within range.');
  }

  return data;
}
