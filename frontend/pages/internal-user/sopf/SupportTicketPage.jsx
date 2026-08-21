import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, StatusBadge } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  createSupportTicket,
  fetchSupportTickets,
  fetchTicketMessages,
  sendTicketMessage,
  updateSupportTicket,
} from '../../../services/supportTickets.js';
import SopfPagination from './SopfPagination.jsx';
import ScrollableTable from './ScrollableTable.jsx';
import SupportTicketHeaderActions from './SupportTicketHeaderActions.jsx';
import {
  TICKET_MSG_COPY,
  formatChatTime,
  formatTicketDate,
} from './supportTicket.constants.js';
import styles from './SupportTicketPage.module.css';

const POLL_INTERVAL_MS = 15000;

export default function SupportTicketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [today, setToday] = useState('');
  const [isMgmtUser, setIsMgmtUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [chatTicket, setChatTicket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatStatus, setChatStatus] = useState('');
  const [chatError, setChatError] = useState('');
  const chatThreadRef = useRef(null);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null ? TICKET_MSG_COPY[Number(flashMsg)] : null;

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSupportTickets({
        page,
        pageSize,
        search: debouncedSearch,
      });
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
      setToday(data.today ?? formatTicketDate(new Date()));
      setIsMgmtUser(Boolean(data.isMgmtUser));
    } catch (err) {
      setError(err.message || 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  const applyTicketUpdate = useCallback((ticket, messages) => {
    if (ticket) {
      setChatTicket(ticket);
      setRows((current) => current.map((row) =>
        row.ticketId === ticket.ticketId ? { ...row, ...ticket } : row,
      ));
    }
    if (messages) {
      setChatMessages(messages);
    }
  }, []);

  const loadChat = useCallback(async (ticketId, { silent = false } = {}) => {
    if (!silent) setChatLoading(true);
    setChatError('');
    try {
      const data = await fetchTicketMessages(ticketId);
      applyTicketUpdate(data.ticket, data.messages);
    } catch (err) {
      if (!silent) {
        setChatError(err.message || 'Failed to load conversation.');
      }
    } finally {
      if (!silent) setChatLoading(false);
    }
  }, [applyTicketUpdate]);

  const openChat = (row) => {
    setChatTicket(row);
    setChatMessages([]);
    setChatInput('');
    setChatStatus('');
    setChatError('');
    loadChat(row.ticketId);
  };

  const closeChat = () => {
    setChatTicket(null);
    setChatMessages([]);
    setChatInput('');
    setChatStatus('');
    setChatError('');
  };

  useEffect(() => {
    if (!chatTicket?.ticketId) return undefined;

    const timer = setInterval(() => {
      loadChat(chatTicket.ticketId, { silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [chatTicket?.ticketId, loadChat]);

  useEffect(() => {
    const node = chatThreadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatMessages, chatLoading]);

  const clearFlash = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await createSupportTicket({ message, files });
      setMessage('');
      setFiles([]);
      setSuccess('Support ticket created successfully.');
      setSearchParams({ msg: '0' }, { replace: true });
      await loadTickets();
    } catch (err) {
      setError(err.message || 'Failed to create support ticket.');
      setSearchParams({ msg: '1' }, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!chatTicket || !chatInput.trim()) return;

    setSubmitting(true);
    setChatError('');
    try {
      if (isMgmtUser && chatStatus) {
        const result = await updateSupportTicket(chatTicket.ticketId, {
          replyMessage: chatInput.trim(),
          status: Number(chatStatus),
        });
        applyTicketUpdate(result.ticket, result.messages);
        setChatInput('');
        setChatStatus('');
        if (Number(chatStatus) === 3) {
          closeChat();
        }
      } else {
        const result = await sendTicketMessage(chatTicket.ticketId, chatInput.trim());
        applyTicketUpdate(result.ticket, result.messages);
        setChatInput('');
      }
      await loadTickets();
    } catch (err) {
      setChatError(err.message || 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!chatTicket || !chatStatus) {
      setChatError('Please select a status.');
      return;
    }

    setSubmitting(true);
    setChatError('');
    try {
      const result = await updateSupportTicket(chatTicket.ticketId, {
        replyMessage: chatInput.trim() || undefined,
        status: Number(chatStatus),
      });
      applyTicketUpdate(result.ticket, result.messages);
      setChatInput('');
      setChatStatus('');
      await loadTickets();
      if (Number(chatStatus) === 3) {
        closeChat();
      }
    } catch (err) {
      setChatError(err.message || 'Failed to update ticket status.');
    } finally {
      setSubmitting(false);
    }
  };

  const showReopenHint = chatTicket?.status === 3 && !isMgmtUser;

  return (
    <div className={`zafira-page ${styles.page}`}>
      <SupportTicketHeaderActions search={searchInput} onSearchChange={setSearchInput} />
      <LoadingOverlay show={loading || submitting} />

      {flash ? (
        <div className={`alert alert-${flash.type} alert-dismissible`} role="alert">
          <strong>{flash.type === 'success' ? 'Success!' : 'Error!'}</strong> {flash.text}
          <button type="button" className="btn-close" aria-label="Close" onClick={clearFlash} />
        </div>
      ) : null}

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="zafira-card">
        <div className="zafira-card-body">
          <h2 className={styles.formTitle}>Add Help Desk Ticket</h2>

          <form onSubmit={handleCreate}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label" htmlFor="ticket-message">Message</label>
                <textarea
                  id="ticket-message"
                  className="form-control"
                  rows={4}
                  placeholder="message ..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="ticket-attachment">Attachment</label>
                <input
                  id="ticket-attachment"
                  type="file"
                  className="form-control"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                {files.length ? (
                  <small className={styles.fileHint}>
                    {files.map((file) => file.name).join(', ')}
                  </small>
                ) : null}
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="ticket-date">Date</label>
                <input
                  id="ticket-date"
                  type="text"
                  className="form-control"
                  value={today || formatTicketDate(new Date())}
                  readOnly
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <Button type="submit" variant="primary" label="Submit" disabled={submitting} />
            </div>
          </form>

          <ScrollableTable
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            footer={(
              <SopfPagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            )}
          >
            <table className="zafira-data-table" id="Ticket_list">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ticket ID</th>
                  <th>Date</th>
                  <th>User Name</th>
                  <th>Message</th>
                  <th>Attachment</th>
                  <th>Reply</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className={styles.emptyState}>Loading support tickets...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={styles.emptyState}>No support tickets found.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.ticketId}>
                      <td>{row.index}</td>
                      <td>{row.ticketId}</td>
                      <td>{row.date}</td>
                      <td>{row.userName}</td>
                      <td className={styles.messageCell}>{row.message}</td>
                      <td>
                        {row.attachments?.length ? (
                          <div className={styles.attachmentList}>
                            {row.attachments.map((attachment) => (
                              <a
                                key={attachment.file}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {attachment.name}
                              </a>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className={styles.messageCell}>{row.reply || '—'}</td>
                      <td>
                        <StatusBadge label={row.statusLabel} tone="ticket" />
                      </td>
                      <td>
                        <Button
                          variant="outlineAccent"
                          size="sm"
                          label="Conversation"
                          icon="chat-left-text"
                          onClick={() => openChat(row)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </div>

      {chatTicket ? (
        <div className={styles.modalBackdrop} onClick={closeChat} role="presentation">
          <div
            className={`${styles.modalDialog} ${styles.ticketChatDialog}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-chat-title"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleWrap}>
                <h5 id="ticket-chat-title">Ticket #{chatTicket.ticketId}</h5>
                <StatusBadge label={chatTicket.statusLabel} tone="ticket" />
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeChat} />
            </div>

            <div className={styles.modalBody}>
              <div className={styles.ticketChatMeta}>
                <span><strong>User:</strong> {chatTicket.userName || '—'}</span>
                <span><strong>Date:</strong> {chatTicket.date || '—'}</span>
                {chatTicket.attachments?.length ? (
                  <span className={styles.ticketChatAttachments}>
                    <strong>Attachments:</strong>
                    {chatTicket.attachments.map((attachment) => (
                      <a
                        key={attachment.file}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {attachment.name}
                      </a>
                    ))}
                  </span>
                ) : null}
              </div>

              <div className={styles.ticketChatThread} ref={chatThreadRef}>
                {chatLoading && chatMessages.length === 0 ? (
                  <p className={styles.ticketChatEmpty}>Loading conversation...</p>
                ) : null}
                {!chatLoading && chatMessages.length === 0 ? (
                  <p className={styles.ticketChatEmpty}>No messages yet.</p>
                ) : null}
                {chatMessages.map((msg) => (
                  <div
                    key={msg.messageId}
                    className={`${styles.ticketChatBubble} ${
                      msg.senderType === 'support'
                        ? styles.ticketChatBubbleSupport
                        : styles.ticketChatBubbleUser
                    }`}
                  >
                    <span className={styles.ticketChatBubbleMeta}>
                      {msg.userName || 'User'} · {formatChatTime(msg.createdAt)}
                    </span>
                    {msg.message}
                  </div>
                ))}
              </div>

              {showReopenHint ? (
                <p className={styles.reopenHint}>
                  This ticket is closed. Your reply will reopen it.
                </p>
              ) : null}

              {chatError ? <div className="alert alert-danger">{chatError}</div> : null}

              <form className={styles.ticketChatComposer} onSubmit={handleSendMessage}>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                />

                {isMgmtUser ? (
                  <select
                    className="form-select"
                    value={chatStatus}
                    onChange={(event) => setChatStatus(event.target.value)}
                    aria-label="Ticket status"
                  >
                    <option value="">---Select from Status---</option>
                    <option value="2">WIP</option>
                    <option value="3">CLOSED</option>
                  </select>
                ) : null}

                <div className={styles.ticketChatActions}>
                  {isMgmtUser ? (
                    <Button
                      type="button"
                      variant="outline"
                      label="Submit"
                      disabled={submitting || !chatStatus}
                      onClick={handleStatusUpdate}
                    />
                  ) : null}
                  <Button
                    type="submit"
                    variant="primary"
                    label={isMgmtUser && chatStatus ? 'Send & Update Status' : 'Send'}
                    disabled={submitting || !chatInput.trim()}
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
