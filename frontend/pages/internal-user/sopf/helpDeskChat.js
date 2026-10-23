const META_PREFIX = /^\[HD\]\s*(.+?)\s*·\s*(.+?)\s*·\s*(.+?)\n/;
const SEEN_KEY = 'zafira.helpDesk.seenTickets';
const LOCAL_KEY = 'zafira.helpDesk.localState';

export const DETECT_DEFAULT = 'SOPF · Period Business';

export const DETECT_OPTIONS = [
  'SOPF · Spot Business',
  'SOPF · Time Charter',
  'SOPF · Period Business',
  'SOPF · Operated Vessels',
  'SOC · Freight Invoice',
  'SOC · Generic Finances',
  'SOC · On-Block Payment',
  'Something else',
];

export const CATEGORY_OPTIONS = [
  'Hire Statement',
  'Freight Invoice',
  'Estimate / Recap',
  'Bunkers',
  'Laytime / Demurrage',
  'Technical Issue',
  'General Question',
  'Other',
];

export const CATEGORY_CODES = {
  'Hire Statement': 'HS',
  'Freight Invoice': 'FI',
  'Estimate / Recap': 'ER',
  Bunkers: 'BK',
  'Laytime / Demurrage': 'LD',
  'Technical Issue': 'TI',
  'General Question': 'GQ',
  Other: 'OT',
};

export const AVATAR_COLORS = {
  SOPF: '#274670',
  SOC: '#5B6472',
};

export const FAQ_LINKS = {
  'Hire Statement': [
    { title: 'How hire statements are calculated', url: 'https://blog.sevenoceans.world/faq/hire-statement-calculation' },
    { title: 'Fixing a rate mismatch on a hire statement', url: 'https://blog.sevenoceans.world/faq/hire-statement-rate-mismatch' },
  ],
  'Freight Invoice': [
    { title: "Why isn't my invoice PDF downloading?", url: 'https://blog.sevenoceans.world/faq/invoice-pdf-not-downloading' },
    { title: 'Freight Invoice: supported export formats', url: 'https://blog.sevenoceans.world/faq/freight-invoice-exports' },
  ],
  'Estimate / Recap': [
    { title: 'How commission splits across multiple cargo lines', url: 'https://blog.sevenoceans.world/faq/commission-multi-cargo' },
    { title: 'Estimate vs. Recap: what carries over automatically', url: 'https://blog.sevenoceans.world/faq/estimate-vs-recap' },
  ],
  Bunkers: [
    { title: 'How off-hire bunkers are allocated to a period', url: 'https://blog.sevenoceans.world/faq/off-hire-bunkers-period' },
  ],
  'Laytime / Demurrage': [
    { title: 'Demurrage rate escalation clauses, explained', url: 'https://blog.sevenoceans.world/faq/demurrage-escalation' },
  ],
  'Technical Issue': [
    { title: 'Vessel positions and AIS refresh timing', url: 'https://blog.sevenoceans.world/faq/vessel-position-refresh' },
  ],
  'General Question': [
    { title: 'Seven Oceans Help Centre — getting started', url: 'https://blog.sevenoceans.world/faq/getting-started' },
  ],
  Other: [],
};

export function encodeHelpDeskMessage({ product, module, category, message }) {
  return `[HD] ${product} · ${module} · ${category}\n${message}`;
}

export function stripHelpDeskMeta(raw) {
  return String(raw || '').replace(META_PREFIX, '');
}

export function truncateSubject(text, max = 70) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value || 'New thread';
  return `${value.slice(0, max)}…`;
}

export function parseHelpDeskMeta(raw) {
  const text = String(raw || '');
  const match = text.match(META_PREFIX);
  if (!match) {
    const body = text.trim();
    return {
      product: 'SOPF',
      module: 'Help Desk',
      category: 'General Question',
      subject: truncateSubject(body),
      body,
    };
  }
  const body = text.slice(match[0].length);
  return {
    product: match[1].trim() || 'SOPF',
    module: match[2].trim() || 'Help Desk',
    category: match[3].trim() || 'General Question',
    subject: truncateSubject(body),
    body,
  };
}

export function splitDetectValue(value) {
  if (value === 'Something else') return { product: 'SOPF', module: 'General' };
  const [product, module] = String(value || DETECT_DEFAULT).split(' · ');
  return {
    product: product || 'SOPF',
    module: module || 'General',
  };
}

export function categoryCode(category) {
  return CATEGORY_CODES[category] || String(category || 'OT').slice(0, 2).toUpperCase();
}

export function toChatStatus(ticket) {
  const status = Number(ticket?.status);
  if (status === 3) return 'resolved';
  if (status === 2) return 'open';
  if (ticket?.reply) return 'open';
  return 'waiting';
}

export function chatStatusLabel(status) {
  if (status === 'waiting') return 'Waiting';
  if (status === 'resolved') return 'Resolved';
  return 'Open';
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SO';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function parseTicketInstant(value) {
  if (!value) return new Date(0);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date(0) : value;
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate;
  const match = String(value).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return new Date(0);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months.findIndex((item) => item.toLowerCase() === match[2].toLowerCase());
  if (month < 0) return new Date(0);
  return new Date(Number(match[3]), month, Number(match[1]));
}

export function formatClock(value) {
  const date = parseTicketInstant(value);
  if (!date.getTime()) return '';
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ap = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ap}`;
}

export function formatOpenedOn(value) {
  const date = parseTicketInstant(value);
  if (!date.getTime()) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${formatClock(date)}`;
}

export function formatAgo(value) {
  const date = parseTicketInstant(value);
  if (!date.getTime()) return '';
  const diff = Math.round((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.round(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function readJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readSeenTickets() {
  return readJson(SEEN_KEY, {});
}

export function markTicketSeen(ticketId) {
  const seen = readSeenTickets();
  seen[String(ticketId)] = Date.now();
  writeJson(SEEN_KEY, seen);
  return seen;
}

export function readLocalThreadState() {
  return readJson(LOCAL_KEY, { participants: {}, inviteNotes: {} });
}

export function writeLocalThreadState(next) {
  writeJson(LOCAL_KEY, next);
}

export function mapTicketToChat(ticket, { seenTickets = {}, participants = [] } = {}) {
  const meta = parseHelpDeskMeta(ticket.message);
  const status = toChatStatus(ticket);
  const previewSource = ticket.reply
    ? ticket.reply
    : meta.body || ticket.message || '';
  return {
    ticketId: ticket.ticketId,
    product: meta.product,
    module: meta.module,
    category: meta.category,
    subject: meta.subject,
    status,
    preview: truncateSubject(previewSource, 90),
    createdAt: ticket.date,
    userName: ticket.userName,
    attachments: ticket.attachments ?? [],
    unread: Boolean(ticket.reply) && !seenTickets[String(ticket.ticketId)],
    agent: ticket.reply ? { name: 'Support', initials: 'SO' } : null,
    participants,
    raw: ticket,
  };
}

export function welcomeSystemText(ticketId, category) {
  return `Thanks — this has been logged as ticket #${ticketId} under ${category}. There's no timer running here, so take your time; a support agent will join as soon as one's free.`;
}
