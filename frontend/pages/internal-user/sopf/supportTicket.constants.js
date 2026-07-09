export const TICKET_STATUS = {
  1: { label: 'OPEN', className: 'open' },
  2: { label: 'WIP', className: 'wip' },
  3: { label: 'CLOSED', className: 'closed' },
};

export const TICKET_MSG_COPY = {
  0: { type: 'success', text: 'Congratulations! Help Desk ticket added/updated successfully.' },
  1: { type: 'danger', text: 'Sorry! there was an error while adding/updating Help Desk ticket.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

export const REPLY_STATUS_OPTIONS = [
  { value: '2', label: 'WIP' },
  { value: '3', label: 'CLOSED' },
];

export function formatTicketDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

export function formatChatTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function getStatusMeta(status) {
  return TICKET_STATUS[Number(status)] ?? { label: String(status ?? ''), className: 'open' };
}
