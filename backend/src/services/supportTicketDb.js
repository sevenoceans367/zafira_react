import { appContext, isDbConfigured } from '../config.js';
import { getPool } from '../db.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';

const STATUS_LABELS = { 1: 'OPEN', 2: 'WIP', 3: 'CLOSED' };

let messageTableReady = false;

export function formatTicketDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function parseAttachments(attachment, attachmentName) {
  const files = String(attachment || '').split(',').map((part) => part.trim()).filter(Boolean);
  const names = String(attachmentName || '').split(',').map((part) => part.trim()).filter(Boolean);
  return files.map((file, index) => ({
    file,
    name: names[index] || file,
    url: attachmentPublicUrl(file),
  }));
}

function mapTicketRecord(row, index) {
  const status = Number(row.STATUS ?? 1);
  return {
    ticketId: row.TICKETID,
    index,
    message: row.MESSAGE ?? '',
    userName: row.USER_NAME ?? '',
    reply: row.REPLY ?? '',
    status,
    statusLabel: STATUS_LABELS[status] ?? 'OPEN',
    date: formatTicketDate(row.DATE),
    attachments: parseAttachments(row.ATTACHMENT, row.ATTACHMENT_NAME),
  };
}

function mapMessageRow(row) {
  return {
    messageId: row.MESSAGE_ID,
    ticketId: row.TICKETID,
    message: row.MESSAGE ?? '',
    userId: row.USER_ID,
    userName: row.USER_NAME ?? '',
    senderType: row.SENDER_TYPE === 'support' ? 'support' : 'user',
    createdAt: row.CREATED_AT,
  };
}

async function ensureMessageTable(pool) {
  if (messageTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_ticket_message (
      MESSAGE_ID INT AUTO_INCREMENT PRIMARY KEY,
      TICKETID INT NOT NULL,
      MESSAGE TEXT,
      USER_ID INT,
      USER_NAME VARCHAR(255),
      SENDER_TYPE ENUM('user','support') NOT NULL DEFAULT 'user',
      CREATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ticket_created (TICKETID, CREATED_AT)
    )
  `);
  messageTableReady = true;
}

async function getTicketRow(pool, ticketId) {
  const [rows] = await pool.query(
    `SELECT TICKETID, MESSAGE, USER_NAME, DATE, STATUS, ATTACHMENT, ATTACHMENT_NAME, REPLY, SO_REPLY
     FROM support_ticket
     WHERE TICKETID = ?`,
    [ticketId],
  );
  return rows[0] ?? null;
}

async function fetchMessages(pool, ticketRow) {
  await ensureMessageTable(pool);
  const [rows] = await pool.query(
    `SELECT MESSAGE_ID, TICKETID, MESSAGE, USER_ID, USER_NAME, SENDER_TYPE, CREATED_AT
     FROM support_ticket_message
     WHERE TICKETID = ?
     ORDER BY CREATED_AT ASC, MESSAGE_ID ASC`,
    [ticketRow.TICKETID],
  );

  if (rows.length) {
    return rows.map(mapMessageRow);
  }

  const legacy = [];
  if (ticketRow.MESSAGE) {
    legacy.push({
      messageId: `legacy-user-${ticketRow.TICKETID}`,
      ticketId: ticketRow.TICKETID,
      message: ticketRow.MESSAGE,
      userId: null,
      userName: ticketRow.USER_NAME ?? '',
      senderType: 'user',
      createdAt: ticketRow.DATE,
    });
  }
  if (ticketRow.REPLY) {
    legacy.push({
      messageId: `legacy-support-${ticketRow.TICKETID}`,
      ticketId: ticketRow.TICKETID,
      message: ticketRow.REPLY,
      userId: null,
      userName: 'Support',
      senderType: 'support',
      createdAt: ticketRow.DATE,
    });
  }
  return legacy;
}

export async function dbListSupportTickets({ page = 1, pageSize = 10, search = '' } = {}) {
  const pool = getPool();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));
  const offset = (safePage - 1) * safePageSize;
  const term = String(search || '').trim();
  const params = [];
  let where = '';

  if (term) {
    where = `WHERE MESSAGE LIKE ? OR USER_NAME LIKE ? OR CAST(TICKETID AS CHAR) LIKE ? OR REPLY LIKE ?`;
    const like = `%${term}%`;
    params.push(like, like, like, like);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM support_ticket ${where}`,
    params,
  );
  const recordsTotal = Number(countRows[0]?.total ?? 0);

  const [rows] = await pool.query(
    `SELECT TICKETID, MESSAGE, USER_NAME, DATE, STATUS, ATTACHMENT, ATTACHMENT_NAME, REPLY, SO_REPLY
     FROM support_ticket
     ${where}
     ORDER BY TICKETID DESC
     LIMIT ? OFFSET ?`,
    [...params, safePageSize, offset],
  );

  const records = rows.map((row, index) => mapTicketRecord(row, offset + index + 1));

  return {
    records,
    recordsTotal,
    page: safePage,
    pageSize: safePageSize,
    today: formatTicketDate(new Date()),
  };
}

export async function dbCreateSupportTicket({ message, attachment = '', attachmentName = '' }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureMessageTable(connection);

    const [result] = await connection.query(
      `INSERT INTO support_ticket (MESSAGE, USER_NAME, STATUS, DATE, ATTACHMENT, ATTACHMENT_NAME)
       VALUES (?, ?, 1, CURDATE(), ?, ?)`,
      [message.trim(), appContext.userName, attachment, attachmentName],
    );

    const ticketId = result.insertId;
    if (!ticketId) {
      await connection.rollback();
      return null;
    }

    await connection.query(
      `INSERT INTO support_ticket_message (TICKETID, MESSAGE, USER_ID, USER_NAME, SENDER_TYPE, CREATED_AT)
       VALUES (?, ?, ?, ?, 'user', NOW())`,
      [ticketId, message.trim(), appContext.userId, appContext.userName],
    );

    await connection.commit();
    return { msg: 0, ticketId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbGetTicketMessages(ticketId) {
  const pool = getPool();
  const ticketRow = await getTicketRow(pool, ticketId);
  if (!ticketRow) return null;

  const messages = await fetchMessages(pool, ticketRow);
  return {
    ticket: mapTicketRecord(ticketRow, 0),
    messages,
  };
}

export async function dbAddTicketMessage(ticketId, { message, senderType }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureMessageTable(connection);

    const ticketRow = await getTicketRow(connection, ticketId);
    if (!ticketRow) {
      await connection.rollback();
      return null;
    }

    const trimmed = message.trim();
    const isSupport = senderType === 'support';
    const userName = isSupport ? appContext.userName : appContext.userName;
    const dbSenderType = isSupport ? 'support' : 'user';

    await connection.query(
      `INSERT INTO support_ticket_message (TICKETID, MESSAGE, USER_ID, USER_NAME, SENDER_TYPE, CREATED_AT)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [ticketId, trimmed, appContext.userId, userName, dbSenderType],
    );

    if (isSupport) {
      const nextStatus = Number(ticketRow.STATUS) === 1 ? 2 : Number(ticketRow.STATUS);
      await connection.query(
        `UPDATE support_ticket SET REPLY = ?, STATUS = ? WHERE TICKETID = ?`,
        [trimmed, nextStatus, ticketId],
      );
    } else {
      await connection.query(
        `UPDATE support_ticket SET STATUS = 1 WHERE TICKETID = ?`,
        [ticketId],
      );
    }

    await connection.commit();

    const updatedRow = await getTicketRow(pool, ticketId);
    const messages = await fetchMessages(pool, updatedRow);
    return {
      ticket: mapTicketRecord(updatedRow, 0),
      messages,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbUpdateSupportTicket(ticketId, { replyMessage, status }) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const nextStatus = Number(status);

  if (![2, 3].includes(nextStatus)) {
    throw new Error('Status must be WIP or CLOSED.');
  }

  try {
    await connection.beginTransaction();
    await ensureMessageTable(connection);

    const ticketRow = await getTicketRow(connection, ticketId);
    if (!ticketRow) {
      await connection.rollback();
      return null;
    }

    const trimmedReply = replyMessage?.trim() ?? '';

    if (trimmedReply) {
      await connection.query(
        `INSERT INTO support_ticket_message (TICKETID, MESSAGE, USER_ID, USER_NAME, SENDER_TYPE, CREATED_AT)
         VALUES (?, ?, ?, ?, 'support', NOW())`,
        [ticketId, trimmedReply, appContext.userId, appContext.userName],
      );
      await connection.query(
        `UPDATE support_ticket SET REPLY = ?, STATUS = ? WHERE TICKETID = ?`,
        [trimmedReply, nextStatus, ticketId],
      );
    } else {
      await connection.query(
        `UPDATE support_ticket SET STATUS = ? WHERE TICKETID = ?`,
        [nextStatus, ticketId],
      );
    }

    await connection.commit();

    const updatedRow = await getTicketRow(pool, ticketId);
    const messages = await fetchMessages(pool, updatedRow);
    return {
      ticket: mapTicketRecord(updatedRow, 0),
      messages,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function isSupportTicketDbAvailable() {
  return isDbConfigured();
}
