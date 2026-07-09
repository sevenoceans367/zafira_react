const BASE = '/api/internal-user/fleet';

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchTankerParticulars(vesselId) {
  const response = await fetch(
    `${BASE}/vessel/${encodeURIComponent(vesselId)}/particulars`,
  );
  return parseJson(response, 'Failed to load vessel particulars.');
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

export async function downloadTankerParticularsPdf(vesselId) {
  const response = await fetch(
    `${BASE}/vessel/${encodeURIComponent(vesselId)}/particulars/pdf`,
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate vessel particulars PDF.');
  }

  const blob = await response.blob();
  const filename = parseFilenameFromDisposition(response.headers.get('Content-Disposition'))
    || 'vessel-particulars.pdf';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function updateTankerParticulars(vesselId, { fields, certificates }) {
  const formData = new FormData();
  formData.append('fields', JSON.stringify(fields ?? {}));
  formData.append(
    'certificates',
    JSON.stringify((certificates ?? []).map((row) => ({
      certificateId: row.certificateId || '',
      dateIssue: row.dateIssue || '',
      dateLastAnnual: row.dateLastAnnual || '',
      dateExpiry: row.dateExpiry || '',
      existingFiles: row.existingFiles || '',
      existingNames: row.existingNames || '',
    }))),
  );

  (certificates ?? []).forEach((row, index) => {
    (row.newFiles ?? []).forEach((file) => {
      formData.append(`attach_file_${index}`, file);
    });
  });

  const response = await fetch(
    `${BASE}/vessel/${encodeURIComponent(vesselId)}/particulars`,
    {
      method: 'POST',
      body: formData,
    },
  );
  return parseJson(response, 'Failed to update vessel particulars.');
}
