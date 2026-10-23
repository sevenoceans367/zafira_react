import { appContext, isMgmtUser } from '../config.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';
import {
  dbAddTicketMessage,
  dbCreateSupportTicket,
  dbGetTicketMessages,
  dbListSupportTickets,
  dbUpdateSupportTicket,
  formatTicketDate,
  isSupportTicketDbAvailable,
} from './supportTicketDb.js';
import {
  dbCreateUserAlert,
  dbListMgmtUserIds,
  dbLogRecentWork,
} from './userAlertsDb.js';

const HELP_DESK_IDENTIFY = 'HELP DESK';
const HELP_DESK_PATH = '/internal-user/sopf/support_ticket';

function resolveActor(actor) {
  return {
    id: actor?.id != null && actor.id !== '' ? String(actor.id) : String(appContext.userId || ''),
    name: actor?.name || appContext.userName || 'Internal User',
    companyId: actor?.companyId ?? appContext.companyId ?? '',
  };
}

function helpDeskHref(ticketId) {
  return `${HELP_DESK_PATH}?ticketId=${encodeURIComponent(ticketId)}`;
}

function ticketOwnerId(messages = []) {
  const firstUser = messages.find((row) => row.senderType !== 'support' && row.userId);
  return firstUser?.userId != null ? String(firstUser.userId) : '';
}

function lastSupportId(messages = []) {
  const support = [...messages].reverse().find((row) => row.senderType === 'support' && row.userId);
  return support?.userId != null ? String(support.userId) : '';
}

async function sendHelpDeskAlerts({ actor, ticketId, comments, recipientIds }) {
  const unique = [...new Set((recipientIds || []).map((id) => String(id)).filter(Boolean))];
  await Promise.all(unique.map((sentTo) => dbCreateUserAlert({
    sentBy: actor.id,
    sentTo,
    redirectTo: helpDeskHref(ticketId),
    identify: HELP_DESK_IDENTIFY,
    comments,
    identifyId: ticketId,
    companyId: actor.companyId,
  })));
}

async function notifyHelpDeskChange({ actor, ticketId, kind, messages = [] }) {
  const user = resolveActor(actor);
  if (!user.id || !ticketId) return;

  const ownerId = ticketOwnerId(messages) || (kind === 'created' ? user.id : '');
  const supportId = lastSupportId(messages);
  let work = `Support ticket #${ticketId} was updated.`;
  let comments = work;
  let recipients = [];

  if (kind === 'created') {
    work = `Support ticket #${ticketId} was created.`;
    comments = work;
    recipients = [
      user.id,
      ...(await dbListMgmtUserIds({ companyId: user.companyId, excludeId: user.id })),
    ];
  } else if (kind === 'support_reply') {
    work = `Replied to support ticket #${ticketId}.`;
    comments = `A support agent has replied to your ticket #${ticketId}.`;
    recipients = [user.id, ownerId];
  } else if (kind === 'user_reply') {
    work = `Replied to support ticket #${ticketId}.`;
    comments = `A new reply was added to ticket #${ticketId}.`;
    recipients = [user.id, supportId];
    if (!supportId) {
      recipients.push(...(await dbListMgmtUserIds({ companyId: user.companyId, excludeId: user.id })));
    }
  } else if (kind === 'resolved') {
    work = `Ticket #${ticketId} was marked resolved.`;
    comments = work;
    recipients = [user.id, ownerId];
  } else if (kind === 'reopened') {
    work = `Ticket #${ticketId} was reopened.`;
    comments = work;
    recipients = [user.id, supportId];
    if (!supportId) {
      recipients.push(...(await dbListMgmtUserIds({ companyId: user.companyId, excludeId: user.id })));
    }
  }

  const unique = [...new Set((recipients || []).map((id) => String(id)).filter(Boolean))];
  const others = unique.filter((id) => id !== user.id);

  await dbLogRecentWork(user.id, work);
  await sendHelpDeskAlerts({
    actor: user,
    ticketId,
    comments: work,
    recipientIds: [user.id],
  });
  await sendHelpDeskAlerts({
    actor: user,
    ticketId,
    comments,
    recipientIds: others,
  });
}

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

function resolveMgmtUser(explicit) {
  return explicit == null ? isMgmtUser() : Boolean(explicit);
}

function paginateRecords(records, page, pageSize, mgmtUser) {
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
    isMgmtUser: resolveMgmtUser(mgmtUser),
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

export async function listSupportTickets({ page = 1, pageSize = 10, search = '', mgmtUser } = {}) {
  const isMgmt = resolveMgmtUser(mgmtUser);
  if (isSupportTicketDbAvailable()) {
    const data = await dbListSupportTickets({ page, pageSize, search });
    return { ...data, isMgmtUser: isMgmt };
  }

  const filtered = filterRecords(
    [...mockTickets].sort((a, b) => b.ticketId - a.ticketId),
    search,
  );
  return paginateRecords(filtered, page, pageSize, isMgmt);
}

export async function createSupportTicket({
  message,
  attachment = '',
  attachmentName = '',
  actor,
} = {}) {
  if (!message?.trim()) {
    throw new Error('Message is required.');
  }

  const user = resolveActor(actor);

  if (isSupportTicketDbAvailable()) {
    const result = await dbCreateSupportTicket({
      message,
      attachment,
      attachmentName,
      actor: user,
    });
    if (!result) throw new Error('Failed to create support ticket.');
    await notifyHelpDeskChange({
      actor: user,
      ticketId: result.ticketId,
      kind: 'created',
    });
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
        url: attachmentPublicUrl(file),
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

export async function sendTicketMessage(ticketId, message, { mgmtUser, actor } = {}) {
  if (!message?.trim()) {
    throw new Error('Message is required.');
  }

  const isMgmt = resolveMgmtUser(mgmtUser);
  const senderType = isMgmt ? 'support' : 'user';
  const user = resolveActor(actor);

  if (isSupportTicketDbAvailable()) {
    const result = await dbAddTicketMessage(ticketId, { message, senderType, actor: user });
    if (!result) throw new Error('Support ticket not found.');
    const kind = isMgmt
      ? 'support_reply'
      : (Number(result.previousStatus) === 3 ? 'reopened' : 'user_reply');
    await notifyHelpDeskChange({
      actor: user,
      ticketId,
      kind,
      messages: result.messages,
    });
    return result;
  }

  const ticket = mockTickets.find((row) => row.ticketId === Number(ticketId));
  if (!ticket) throw new Error('Support ticket not found.');

  const entry = {
    messageId: mockMessageCounter++,
    ticketId: Number(ticketId),
    message: message.trim(),
    userId: 1,
    userName: isMgmt ? 'Support User' : 'Internal User',
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

export async function updateSupportTicket(ticketId, { replyMessage, status, mgmtUser, actor }) {
  if (!resolveMgmtUser(mgmtUser)) {
    throw new Error('Only management users can update ticket status.');
  }
  if (!status || ![2, 3].includes(Number(status))) {
    throw new Error('Status must be WIP or CLOSED.');
  }

  const user = resolveActor(actor);

  if (isSupportTicketDbAvailable()) {
    const result = await dbUpdateSupportTicket(ticketId, { replyMessage, status, actor: user });
    if (!result) throw new Error('Support ticket not found.');
    await notifyHelpDeskChange({
      actor: user,
      ticketId,
      kind: Number(status) === 3 ? 'resolved' : 'support_reply',
      messages: result.messages,
    });
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
