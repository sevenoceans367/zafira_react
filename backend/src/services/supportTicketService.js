import { isMgmtUser } from '../config.js';
import {
  dbAddTicketMessage,
  dbCreateSupportTicket,
  dbGetTicketMessages,
  dbListSupportTickets,
  dbUpdateSupportTicket,
  formatTicketDate,
  isSupportTicketDbAvailable,
} from './supportTicketDb.js';

/** In-memory fallback when DB is unavailable */
let mockTickets = [
  {
    ticketId: 1001,
    index: 1,
    message: 'Sample support ticket for local development.',
    userName: 'Internal User',
    date: formatTicketDate(new Date()),
    status: 1,
    statusLabel: 'OPEN',
    attachments: [],
    reply: '',
  },
];

let mockMessages = {
  1001: [
    {
      messageId: 1,
      ticketId: 1001,
      message: 'Sample support ticket for local development.',
      userId: 1,
      userName: 'Internal User',
      senderType: 'user',
      createdAt: new Date().toISOString(),
    },
  ],
};

let mockCounter = 1002;
let mockMessageCounter = 100;

function paginateRecords(records, page, pageSize) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const start = (safePage - 1) * safePageSize;
  return {
    records: records.slice(start, start + safePageSize).map((row, index) => ({
      ...row,
      index: start + index + 1,
    })),
    recordsTotal: records.length,
    page: safePage,
    pageSize: safePageSize,
    today: formatTicketDate(new Date()),
    isMgmtUser: isMgmtUser(),
  };
}

function filterRecords(records, search) {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return records;
  return records.filter((row) =>
    String(row.ticketId).includes(term)
    || row.message.toLowerCase().includes(term)
    || row.userName.toLowerCase().includes(term)
    || (row.reply || '').toLowerCase().includes(term),
  );
}

export async function listSupportTickets({ page = 1, pageSize = 10, search = '' } = {}) {
  if (isSupportTicketDbAvailable()) {
    const data = await dbListSupportTickets({ page, pageSize, search });
    return { ...data, isMgmtUser: isMgmtUser() };
  }

  const filtered = filterRecords(
    [...mockTickets].sort((a, b) => b.ticketId - a.ticketId),
    search,
  );
  return paginateRecords(filtered, page, pageSize);
}

export async function createSupportTicket({ message, attachment = '', attachmentName = '' }) {
  if (!message?.trim()) {
    throw new Error('Message is required.');
  }

  if (isSupportTicketDbAvailable()) {
    const result = await dbCreateSupportTicket({ message, attachment, attachmentName });
    if (!result) throw new Error('Failed to create support ticket.');
    return result;
  }

  const ticketId = mockCounter++;
  const ticket = {
    ticketId,
    index: 1,
    message: message.trim(),
    userName: 'Internal User',
    date: formatTicketDate(new Date()),
    status: 1,
    statusLabel: 'OPEN',
    attachments: attachment
      ? attachment.split(',').map((file, index) => ({
        file,
        name: attachmentName.split(',')[index] || file,
        url: `/attachment/${file}`,
      }))
      : [],
    reply: '',
  };
  mockTickets = [ticket, ...mockTickets];
  mockMessages[ticketId] = [{
    messageId: mockMessageCounter++,
    ticketId,
    message: message.trim(),
    userId: 1,
    userName: 'Internal User',
    senderType: 'user',
    createdAt: new Date().toISOString(),
  }];
  return { msg: 0, ticketId };
}

export async function getTicketMessages(ticketId) {
  if (isSupportTicketDbAvailable()) {
    const result = await dbGetTicketMessages(ticketId);
    if (!result) throw new Error('Support ticket not found.');
    return result;
  }

  const ticket = mockTickets.find((row) => row.ticketId === Number(ticketId));
  if (!ticket) throw new Error('Support ticket not found.');
  return {
    ticket,
    messages: mockMessages[ticket.ticketId] ?? [],
  };
}

export async function sendTicketMessage(ticketId, message) {
  if (!message?.trim()) {
    throw new Error('Message is required.');
  }

  const senderType = isMgmtUser() ? 'support' : 'user';

  if (isSupportTicketDbAvailable()) {
    const result = await dbAddTicketMessage(ticketId, { message, senderType });
    if (!result) throw new Error('Support ticket not found.');
    return result;
  }

  const ticket = mockTickets.find((row) => row.ticketId === Number(ticketId));
  if (!ticket) throw new Error('Support ticket not found.');

  const entry = {
    messageId: mockMessageCounter++,
    ticketId: Number(ticketId),
    message: message.trim(),
    userId: 1,
    userName: isMgmtUser() ? 'Support User' : 'Internal User',
    senderType,
    createdAt: new Date().toISOString(),
  };
  mockMessages[ticket.ticketId] = [...(mockMessages[ticket.ticketId] ?? []), entry];

  mockTickets = mockTickets.map((row) => {
    if (row.ticketId !== Number(ticketId)) return row;
    if (senderType === 'support') {
      return {
        ...row,
        reply: message.trim(),
        status: row.status === 1 ? 2 : row.status,
        statusLabel: row.status === 1 ? 'WIP' : row.statusLabel,
      };
    }
    return { ...row, status: 1, statusLabel: 'OPEN' };
  });

  return {
    ticket: mockTickets.find((row) => row.ticketId === Number(ticketId)),
    messages: mockMessages[ticket.ticketId],
  };
}

export async function updateSupportTicket(ticketId, { replyMessage, status }) {
  if (!isMgmtUser()) {
    throw new Error('Only management users can update ticket status.');
  }
  if (!status || ![2, 3].includes(Number(status))) {
    throw new Error('Status must be WIP or CLOSED.');
  }

  if (isSupportTicketDbAvailable()) {
    const result = await dbUpdateSupportTicket(ticketId, { replyMessage, status });
    if (!result) throw new Error('Support ticket not found.');
    return result;
  }

  const ticket = mockTickets.find((row) => row.ticketId === Number(ticketId));
  if (!ticket) throw new Error('Support ticket not found.');

  const trimmedReply = replyMessage?.trim() ?? '';
  if (trimmedReply) {
    mockMessages[ticket.ticketId] = [
      ...(mockMessages[ticket.ticketId] ?? []),
      {
        messageId: mockMessageCounter++,
        ticketId: Number(ticketId),
        message: trimmedReply,
        userId: 1,
        userName: 'Support User',
        senderType: 'support',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const statusLabel = Number(status) === 3 ? 'CLOSED' : 'WIP';
  mockTickets = mockTickets.map((row) =>
    row.ticketId === Number(ticketId)
      ? {
          ...row,
          status: Number(status),
          statusLabel,
          reply: trimmedReply || row.reply,
        }
      : row,
  );

  return {
    ticket: mockTickets.find((row) => row.ticketId === Number(ticketId)),
    messages: mockMessages[ticket.ticketId] ?? [],
  };
}
