import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash, { useFlashState } from '../../../hooks/useTimedFlash.js';
import { useSearchParams } from 'react-router-dom';
import { getUser } from '@bainbridge/shared-auth';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  createSupportTicket,
  fetchSupportTickets,
  fetchTicketMessages,
  sendTicketMessage,
  updateSupportTicket,
} from '../../../services/supportTickets.js';
import { notifyRecentWorkUpdated } from '../../../services/recentWork.js';
import { notifyAlertsUpdated } from '../../../services/userAlerts.js';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import { TICKET_MSG_COPY } from './supportTicket.constants.js';
import {
  AVATAR_COLORS,
  CATEGORY_OPTIONS,
  DETECT_DEFAULT,
  DETECT_OPTIONS,
  FAQ_LINKS,
  categoryCode,
  chatStatusLabel,
  encodeHelpDeskMessage,
  formatAgo,
  formatClock,
  formatOpenedOn,
  initialsOf,
  mapTicketToChat,
  markTicketSeen,
  parseHelpDeskMeta,
  readLocalThreadState,
  readSeenTickets,
  splitDetectValue,
  stripHelpDeskMeta,
  welcomeSystemText,
  writeLocalThreadState,
} from './helpDeskChat.js';
import styles from './SupportTicketPage.module.css';

const POLL_INTERVAL_MS = 15000;
const LIST_PAGE_SIZE = 100;

function sessionIsMgmtUser() {
  return getUser()?.userType === 'mgmt_user';
}

function refreshHeaderFeeds() {
  notifyRecentWorkUpdated();
  notifyAlertsUpdated();
}

const HELP_DESK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

function HelpDeskHeading() {
  const setHeading = usePageHeaderHeading();
  useLayoutEffect(() => {
    setHeading({ title: 'Help Desk', icon: HELP_DESK_ICON });
  }, [setHeading]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7a2 2 0 0 1 2-2h8l6 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <path d="M14 5v4a2 2 0 0 0 2 2h4" />
      <path d="m12.5 16.5 4-4 2 2-4 4H12.5v-2z" />
    </svg>
  );
}

function DetectIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function CloseXIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function FaqInfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ExtIcon() {
  return (
    <svg className={styles.faqExt} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.4 11.1l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.1 8.1a1.5 1.5 0 0 1-2.1-2.1l7.4-7.4" />
    </svg>
  );
}

function AttachmentList({ items, tone = 'default' }) {
  if (!items?.length) return null;
  return (
    <div className={`${styles.attachmentLinks} ${tone === 'me' ? styles.attachmentLinksMe : ''}`}>
      {items.map((attachment) => (
        <a
          key={attachment.file || attachment.name}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
        >
          {attachment.name}
        </a>
      ))}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function WaitingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function StatusChip({ status }) {
  const className = status === 'waiting'
    ? styles.stWaiting
    : status === 'resolved'
      ? styles.stResolved
      : styles.stOpen;
  return <span className={`${styles.statusChip} ${className}`}>{chatStatusLabel(status)}</span>;
}

function FaqCardList({ links }) {
  if (!links?.length) return null;
  return (
    <div className={styles.faqCards}>
      {links.map((item) => (
        <a key={item.url} className={styles.faqCard} href={item.url} target="_blank" rel="noopener noreferrer">
          <FaqInfoIcon />
          <span>{item.title}</span>
          <ExtIcon />
        </a>
      ))}
    </div>
  );
}

export default function SupportTicketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [listFilter, setListFilter] = useState('all');
  const [isMgmtUser, setIsMgmtUser] = useState(() => sessionIsMgmtUser());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useFlashState('');

  const [activeTicketId, setActiveTicketId] = useState(null);
  const [chatTicket, setChatTicket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [detectValue, setDetectValue] = useState(DETECT_DEFAULT);
  const [detectEditing, setDetectEditing] = useState(false);
  const [category, setCategory] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [categoryInvalid, setCategoryInvalid] = useState(false);
  const [messageInvalid, setMessageInvalid] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [composerFiles, setComposerFiles] = useState([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteChips, setInviteChips] = useState([]);
  const [participantsByTicket, setParticipantsByTicket] = useState(() => readLocalThreadState().participants || {});
  const [inviteNotesByTicket, setInviteNotesByTicket] = useState(() => readLocalThreadState().inviteNotes || {});
  const [seenTickets, setSeenTickets] = useState(() => readSeenTickets());

  const chatThreadRef = useRef(null);
  const inviteWrapRef = useRef(null);
  const openedFromUrlRef = useRef(false);
  const composerFileRef = useRef(null);
  const newFileRef = useRef(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const ticketFromUrl = searchParams.get('ticketId') || searchParams.get('ticketid');
  const flash = useTimedFlash(flashMsg != null ? TICKET_MSG_COPY[Number(flashMsg)] : null);

  const persistLocal = useCallback((participants, inviteNotes) => {
    writeLocalThreadState({
      participants,
      inviteNotes,
    });
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSupportTickets({
        page: 1,
        pageSize: LIST_PAGE_SIZE,
        search: debouncedSearch,
      });
      setRows(data.records ?? []);
      setIsMgmtUser(Boolean(data.isMgmtUser) || sessionIsMgmtUser());
    } catch (err) {
      setError(err.message || 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const chats = useMemo(
    () => rows.map((row) => mapTicketToChat(row, {
      seenTickets,
      participants: participantsByTicket[String(row.ticketId)] || [],
    })),
    [rows, seenTickets, participantsByTicket],
  );

  const visibleChats = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    return chats.filter((chat) => {
      if (listFilter === 'open' && chat.status === 'resolved') return false;
      if (listFilter === 'resolved' && chat.status !== 'resolved') return false;
      if (!term) return true;
      return [chat.subject, chat.category, chat.module, chat.product, String(chat.ticketId)]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [chats, listFilter, searchInput]);

  const applyTicketUpdate = useCallback((ticket, messages) => {
    if (ticket) {
      setChatTicket(ticket);
      setRows((current) => {
        const exists = current.some((row) => row.ticketId === ticket.ticketId);
        if (!exists) return [ticket, ...current];
        return current.map((row) => (row.ticketId === ticket.ticketId ? { ...row, ...ticket } : row));
      });
    }
    if (messages) setChatMessages(messages);
  }, []);

  const loadChat = useCallback(async (ticketId, { silent = false } = {}) => {
    if (!silent) setChatLoading(true);
    setChatError('');
    try {
      const data = await fetchTicketMessages(ticketId);
      applyTicketUpdate(data.ticket, data.messages);
    } catch (err) {
      if (!silent) setChatError(err.message || 'Failed to load conversation.');
    } finally {
      if (!silent) setChatLoading(false);
    }
  }, [applyTicketUpdate]);

  const selectChat = useCallback((ticketId) => {
    const numericId = Number(ticketId);
    const id = Number.isNaN(numericId) ? ticketId : numericId;
    const row = rows.find((item) => String(item.ticketId) === String(id));
    setActiveTicketId(id);
    setChatTicket(row || { ticketId: id });
    setChatMessages([]);
    setChatInput('');
    setChatError('');
    setInviteOpen(false);
    setInviteChips([]);
    setInviteName('');
    setComposerFiles([]);
    setSeenTickets(markTicketSeen(id));
    loadChat(id);
  }, [loadChat, rows]);

  useEffect(() => {
    if (openedFromUrlRef.current || loading || !ticketFromUrl) return;
    openedFromUrlRef.current = true;
    selectChat(ticketFromUrl);
  }, [ticketFromUrl, loading, selectChat]);

  useEffect(() => {
    if (!activeTicketId) return undefined;
    const timer = setInterval(() => {
      loadChat(activeTicketId, { silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeTicketId, loadChat]);

  useEffect(() => {
    const node = chatThreadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatMessages, chatLoading, activeTicketId]);

  useEffect(() => {
    if (!inviteOpen) return undefined;
    const handleClick = (event) => {
      if (inviteWrapRef.current && !inviteWrapRef.current.contains(event.target)) {
        setInviteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [inviteOpen]);

  const clearFlash = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const openNewThread = () => {
    setDetectValue(DETECT_DEFAULT);
    setDetectEditing(false);
    setCategory('');
    setNewMessage('');
    setCategoryInvalid(false);
    setMessageInvalid(false);
    setNewFiles([]);
    setNewOpen(true);
  };

  const closeNewThread = () => setNewOpen(false);

  const handleCreate = async () => {
    const trimmed = newMessage.trim();
    const missingCategory = !category;
    const missingMessage = !trimmed;
    setCategoryInvalid(missingCategory);
    setMessageInvalid(missingMessage);
    if (missingCategory || missingMessage) return;

    const { product, module } = splitDetectValue(detectValue);
    const payload = encodeHelpDeskMessage({
      product,
      module,
      category,
      message: trimmed,
    });

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await createSupportTicket({ message: payload, files: newFiles });
      closeNewThread();
      setSearchParams({ msg: '0' }, { replace: true });
      refreshHeaderFeeds();
      await loadTickets();
      if (result?.ticketId) {
        setActiveTicketId(result.ticketId);
        setChatTicket({ ticketId: result.ticketId });
        setChatMessages([]);
        setChatInput('');
        setChatError('');
        setComposerFiles([]);
        setNewFiles([]);
        setSeenTickets(markTicketSeen(result.ticketId));
        await loadChat(result.ticketId);
      }
    } catch (err) {
      setError(err.message || 'Failed to create support ticket.');
      setSearchParams({ msg: '1' }, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatTicket || (!chatInput.trim() && !composerFiles.length)) return;
    setSubmitting(true);
    setChatError('');
    try {
      const result = await sendTicketMessage(chatTicket.ticketId, chatInput.trim(), composerFiles);
      applyTicketUpdate(result.ticket, result.messages);
      setChatInput('');
      setComposerFiles([]);
      refreshHeaderFeeds();
      await loadTickets();
    } catch (err) {
      setChatError(err.message || 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!chatTicket || !isMgmtUser) return;
    setSubmitting(true);
    setChatError('');
    try {
      const result = await updateSupportTicket(chatTicket.ticketId, { status: 3 });
      applyTicketUpdate(result.ticket, result.messages);
      refreshHeaderFeeds();
      await loadTickets();
    } catch (err) {
      setChatError(err.message || 'Failed to update ticket status.');
    } finally {
      setSubmitting(false);
    }
  };

  const addInviteChip = () => {
    const name = inviteName.trim();
    if (!name) return;
    setInviteChips((current) => [...current, name]);
    setInviteName('');
  };

  const sendInvite = () => {
    if (!activeTicketId || !inviteChips.length) {
      setInviteOpen(false);
      return;
    }
    const nextPeople = inviteChips.map((name) => ({ name, initials: initialsOf(name) }));
    const nextMap = {
      ...participantsByTicket,
      [String(activeTicketId)]: [
        ...(participantsByTicket[String(activeTicketId)] || []),
        ...nextPeople,
      ],
    };
    const nextNotes = {
      ...inviteNotesByTicket,
      [String(activeTicketId)]: [
        ...(inviteNotesByTicket[String(activeTicketId)] || []),
        ...nextPeople.map((person) => ({
          text: `${person.name} was added to this chat.`,
          at: new Date().toISOString(),
        })),
      ],
    };
    setParticipantsByTicket(nextMap);
    setInviteNotesByTicket(nextNotes);
    persistLocal(nextMap, nextNotes);
    setInviteChips([]);
    setInviteName('');
    setInviteOpen(false);
  };

  const faqLinks = FAQ_LINKS[category] || [];
  const activeChat = chats.find((chat) => chat.ticketId === activeTicketId) || null;
  const activeMeta = parseHelpDeskMeta(chatTicket?.message || activeChat?.raw?.message || '');
  const supportAgent = [...chatMessages].reverse().find((msg) => msg.senderType === 'support');
  const agent = supportAgent
    ? { name: supportAgent.userName || 'Support', initials: initialsOf(supportAgent.userName || 'Support') }
    : activeChat?.agent;
  const threadStatus = activeChat?.status || (Number(chatTicket?.status) === 3 ? 'resolved' : 'waiting');
  const participants = participantsByTicket[String(activeTicketId)] || [];
  const waitingWelcome = threadStatus === 'waiting' && chatTicket;
  const composerPlaceholder = threadStatus === 'resolved'
    ? 'Drop a message to reopen this thread.'
    : 'Type a message… this chat is never timed';

  const displayMessages = useMemo(() => {
    const mapped = chatMessages.map((msg, index) => {
      const isSupport = msg.senderType === 'support';
      const isMe = isMgmtUser ? isSupport : !isSupport;
      const text = index === 0 && msg.senderType !== 'support'
        ? stripHelpDeskMeta(msg.message)
        : msg.message;
      return { ...msg, isMe, text, attachments: msg.attachments || [] };
    });
    return mapped;
  }, [chatMessages, isMgmtUser]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <HelpDeskHeading />
      <LoadingOverlay show={loading || submitting} />

      {flash ? (
        <div className={`alert alert-${flash.type} alert-dismissible ${styles.flash}`} role="alert">
          <strong>{flash.type === 'success' ? 'Success!' : 'Error!'}</strong> {flash.text}
          <button type="button" className="btn-close" aria-label="Close" onClick={clearFlash} />
        </div>
      ) : null}
      {error ? <div className={`alert alert-danger ${styles.flash}`}>{error}</div> : null}
      {success ? <div className={`alert alert-success ${styles.flash}`}>{success}</div> : null}

      <div className={styles.chatLayout}>
        <div className={styles.listPane}>
          <div className={styles.listHead}>
            <div className={styles.search}>
              <SearchIcon />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search your chats…"
              />
            </div>
            <div className={styles.filters}>
              {['all', 'open', 'resolved'].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.filter} ${listFilter === key ? styles.filterActive : ''}`}
                  onClick={() => setListFilter(key)}
                >
                  {key === 'all' ? 'All' : key === 'open' ? 'Open' : 'Resolved'}
                </button>
              ))}
              <button type="button" className={styles.composeBtn} title="Start a new thread" onClick={openNewThread}>
                <ComposeIcon />
              </button>
            </div>
          </div>
          <div className={styles.list}>
            {visibleChats.length === 0 ? (
              <div className={styles.emptyList}>
                No chats match here. Try a different search or filter, or start a new chat.
              </div>
            ) : (
              visibleChats.map((chat) => (
                <button
                  key={chat.ticketId}
                  type="button"
                  className={`${styles.chatItem} ${chat.ticketId === activeTicketId ? styles.chatItemActive : ''}`}
                  onClick={() => selectChat(chat.ticketId)}
                >
                  <div
                    className={styles.avatar}
                    style={{ background: AVATAR_COLORS[chat.product] || AVATAR_COLORS.SOPF }}
                  >
                    {categoryCode(chat.category)}
                  </div>
                  <div className={styles.itemBody}>
                    <div className={styles.itemTop}>
                      <div className={styles.itemSubject}>{chat.subject}</div>
                      <div className={styles.itemTime}>{formatAgo(chat.createdAt)}</div>
                    </div>
                    <div className={styles.itemPreview}>{chat.preview}</div>
                    <div className={styles.itemFoot}>
                      <StatusChip status={chat.status} />
                      {chat.unread && chat.ticketId !== activeTicketId ? <span className={styles.unreadDot} title="Unread" /> : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={styles.threadPane}>
          {!activeTicketId ? (
            <div className={styles.threadEmpty}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <div className={styles.threadEmptyTitle}>Select a chat, or start a new one</div>
              <div className={styles.threadEmptySub}>Nothing is timed here — pick up a conversation whenever suits you.</div>
            </div>
          ) : (
            <>
              <div className={styles.threadHead}>
                <div className={styles.threadHeadLeft}>
                  <div className={styles.threadHeadBadges}>
                    <span className={`${styles.statusChip} ${styles.stNeutral}`}>
                      {activeMeta.product} · {activeMeta.module}
                    </span>
                    <StatusChip status={threadStatus} />
                  </div>
                  <div className={styles.threadSubject}>{activeMeta.subject}</div>
                  <div className={styles.threadRef}>
                    Ticket #{activeTicketId} · {activeMeta.category} · opened {formatOpenedOn(chatTicket?.date || activeChat?.createdAt)}
                  </div>
                </div>
                <div className={styles.threadHeadRight} ref={inviteWrapRef}>
                  {agent ? (
                    <div className={styles.agentPill}>
                      <span className={styles.agentAvatar}>{agent.initials}</span>
                      <span className={styles.agentName}>{agent.name}</span>
                    </div>
                  ) : (
                    <div className={styles.waitingPill}>
                      <WaitingIcon />
                      Waiting for an agent
                    </div>
                  )}
                  {participants.length ? (
                    <div className={styles.participantStack}>
                      {participants.map((person) => (
                        <span key={`${person.name}-${person.initials}`} className={styles.ptAvatar} title={person.name}>
                          {person.initials}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {isMgmtUser && threadStatus !== 'resolved' ? (
                    <button type="button" className={styles.resolveBtn} onClick={handleMarkResolved} disabled={submitting}>
                      Mark resolved
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.inviteBtn}
                    title="Loop in a team member"
                    onClick={() => setInviteOpen((open) => !open)}
                  >
                    <InviteIcon />
                    Invite
                  </button>
                  <div className={`${styles.invitePop} ${inviteOpen ? styles.invitePopOpen : ''}`}>
                    <div className={styles.invitePopLabel}>Loop in a team member</div>
                    <div className={styles.chipSelect}>
                      {inviteChips.map((name, index) => (
                        <span key={`${name}-${index}`} className={styles.gchip}>
                          {name}
                          <button
                            type="button"
                            className={styles.gchipX}
                            onClick={() => setInviteChips((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        className={styles.chipInput}
                        value={inviteName}
                        placeholder="Name, then Enter…"
                        onChange={(event) => setInviteName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addInviteChip();
                          }
                        }}
                      />
                    </div>
                    <div className={styles.inviteFoot}>
                      <button type="button" className={styles.addInviteBtn} onClick={sendInvite}>
                        <PlusIcon />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.threadBody} ref={chatThreadRef}>
                {chatLoading && displayMessages.length === 0 ? (
                  <p className={styles.emptyList}>Loading conversation...</p>
                ) : null}
                {displayMessages.map((msg, index) => (
                  <React.Fragment key={msg.messageId}>
                    <div className={`${styles.msgRow} ${msg.isMe ? styles.msgMe : ''}`}>
                      <div
                        className={styles.msgAvatar}
                        style={{ background: msg.isMe ? '#274670' : '#14919B' }}
                      >
                        {msg.isMe ? 'Y' : initialsOf(msg.userName || 'Support')}
                      </div>
                      <div className={styles.msgWrap}>
                        {msg.isMe ? null : <div className={styles.msgName}>{msg.userName || 'Support'}</div>}
                        <div className={styles.msgBubble}>
                          {msg.text}
                          <AttachmentList items={msg.attachments} tone={msg.isMe ? 'me' : 'default'} />
                        </div>
                        <div className={styles.msgTime}>{formatClock(msg.createdAt)}</div>
                      </div>
                    </div>
                    {waitingWelcome && index === 0 ? (
                      <div className={`${styles.msgRow} ${styles.msgSystem}`}>
                        <div className={styles.msgBubble}>
                          {welcomeSystemText(activeTicketId, activeMeta.category)}
                          {(FAQ_LINKS[activeMeta.category] || []).length ? ' In the meantime, these might help:' : ''}
                          <FaqCardList links={FAQ_LINKS[activeMeta.category]} />
                        </div>
                      </div>
                    ) : null}
                  </React.Fragment>
                ))}
                {(inviteNotesByTicket[String(activeTicketId)] || []).map((note, index) => (
                  <div key={`invite-${index}`} className={`${styles.msgRow} ${styles.msgSystem}`}>
                    <div className={styles.msgBubble}>{note.text}</div>
                  </div>
                ))}
              </div>

              {chatError ? <div className={`alert alert-danger ${styles.threadError}`}>{chatError}</div> : null}

              <form
                className={styles.composer}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSendMessage();
                }}
              >
                <input
                  ref={composerFileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(event) => {
                    setComposerFiles(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className={styles.composerAttach}
                  title="Attach a file"
                  onClick={() => composerFileRef.current?.click()}
                >
                  <AttachIcon />
                </button>
                <div className={styles.composerMain}>
                  <textarea
                    rows={1}
                    placeholder={composerPlaceholder}
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  {composerFiles.length ? (
                    <div className={styles.fileChips}>
                      {composerFiles.map((file, index) => (
                        <span key={`${file.name}-${index}`} className={styles.fileChip}>
                          {file.name}
                          <button
                            type="button"
                            className={styles.fileChipX}
                            onClick={() => setComposerFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`Remove ${file.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="submit"
                  className={styles.sendBtn}
                  title="Send"
                  disabled={submitting || (!chatInput.trim() && !composerFiles.length)}
                >
                  <SendIcon />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div
        className={`${styles.scrim} ${newOpen ? styles.scrimOpen : ''}`}
        onClick={closeNewThread}
        role="presentation"
      />
      <div className={`${styles.modal} ${newOpen ? styles.modalOpen : ''}`} role="dialog" aria-modal="true" aria-labelledby="new-thread-title">
        <div className={styles.modalHead}>
          <div className={styles.modalHeadLeft}>
            <div className={styles.modalTitleIco}>{HELP_DESK_ICON}</div>
            <div>
              <div className={styles.modalTitle} id="new-thread-title">Start a New Thread</div>
              <div className={styles.modalSub}>A couple of quick details so the right person sees this first.</div>
            </div>
          </div>
          <button type="button" className={styles.modalClose} onClick={closeNewThread} aria-label="Close">
            <CloseXIcon />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>1. I think this is about</label>
            <div className={styles.detectRow}>
              {detectEditing ? null : (
                <span className={styles.detectChip}>
                  <DetectIcon />
                  {detectValue}
                </span>
              )}
              <button type="button" className={styles.detectEdit} onClick={() => setDetectEditing((open) => !open)}>
                {detectEditing ? 'Cancel' : 'Not this? Change it'}
              </button>
            </div>
            {detectEditing ? (
              <select
                value={detectValue}
                onChange={(event) => {
                  setDetectValue(event.target.value);
                  setDetectEditing(false);
                }}
              >
                {DETECT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="helpdesk-category">2. What's this regarding?</label>
            <select
              id="helpdesk-category"
              className={categoryInvalid ? styles.fieldInvalid : ''}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setCategoryInvalid(false);
              }}
            >
              <option value="">— Select —</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {faqLinks.length ? (
            <div>
              <div className={styles.faqSuggestHead}>You might find these useful first</div>
              <FaqCardList links={faqLinks} />
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="helpdesk-new-message">3. Briefly describe your issue</label>
            <textarea
              id="helpdesk-new-message"
              className={messageInvalid ? styles.fieldInvalid : ''}
              placeholder="Tell us what's going on…"
              value={newMessage}
              onChange={(event) => {
                setNewMessage(event.target.value);
                setMessageInvalid(false);
              }}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="helpdesk-new-files">Attachment</label>
            <input
              ref={newFileRef}
              id="helpdesk-new-files"
              type="file"
              multiple
              onChange={(event) => setNewFiles(Array.from(event.target.files ?? []))}
            />
            {newFiles.length ? (
              <div className={styles.fileChips}>
                {newFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`} className={styles.fileChip}>
                    {file.name}
                    <button
                      type="button"
                      className={styles.fileChipX}
                      onClick={() => {
                        setNewFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
                        if (newFileRef.current) newFileRef.current.value = '';
                      }}
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.modalFoot}>
          <button type="button" className={styles.ghostBtn} onClick={closeNewThread}>
            <CloseXIcon />
            Cancel
          </button>
          <button type="button" className={styles.navyBtn} onClick={handleCreate} disabled={submitting}>
            {HELP_DESK_ICON}
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
