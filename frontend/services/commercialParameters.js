const BASE = '/api/internal-user/fleet';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchCommercialParameters(vesselId) {
  const response = await fetch(
    `${BASE}/vessel/${encodeURIComponent(vesselId)}/commercial-parameters`,
  );
  return parseJson(response, 'Failed to load commercial parameters.');
}

export async function saveCommercialParameters(vesselId, payload) {
  const response = await fetch(
    `${BASE}/vessel/${encodeURIComponent(vesselId)}/commercial-parameters`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return parseJson(response, 'Failed to save commercial parameters.');
}

function parseFilenameFromDisposition(disposition) {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

export async function downloadCommercialParametersPdf(vesselId) {
  const response = await fetch(
    `${BASE}/vessel/${encodeURIComponent(vesselId)}/commercial-parameters/pdf`,
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate commercial parameters PDF.');
  }

  const blob = await response.blob();
  const filename = parseFilenameFromDisposition(response.headers.get('Content-Disposition'))
    || 'commercial-parameters.pdf';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
