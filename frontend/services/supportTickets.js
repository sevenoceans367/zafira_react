const BASE = '/api/internal-user/sopf';

export async function fetchSupportTickets({ page = 1, pageSize = 10, search = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search) params.set('search', search);

  const response = await fetch(`${BASE}/support_tickets?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load support tickets.');
  }
  return data;
}

export async function createSupportTicket({ message, files = [] }) {
  const formData = new FormData();
  formData.append('message', message);
  for (const file of files) {
    formData.append('mul_file', file);
  }

  const response = await fetch(`${BASE}/support_tickets`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create support ticket.');
  }
  return data;
}

export async function fetchTicketMessages(ticketId) {
  const response = await fetch(`${BASE}/support_tickets/${encodeURIComponent(ticketId)}/messages`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load ticket conversation.');
  }
  return data;
}

export async function sendTicketMessage(ticketId, message) {
  const response = await fetch(`${BASE}/support_tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send message.');
  }
  return data;
}

export async function updateSupportTicket(ticketId, { replyMessage, status }) {
  const response = await fetch(`${BASE}/support_tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyMessage, status }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update support ticket.');
  }
  return data;
}
