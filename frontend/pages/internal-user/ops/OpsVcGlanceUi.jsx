import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SummaryCard, SummaryCardGrid } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import SopfPagination from '../sopf/SopfPagination.jsx';
import styles from './OpsVcInOpsGlancePage.module.css';

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 50;

export const STAT_ICONS = {
  trades: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  ),
  vessels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 14l1.3-5.2A2 2 0 0 1 8.2 7.3h7.6a2 2 0 0 1 1.9 1.5L19 14" />
      <path d="M12 3v4.3" />
      <path d="M12 3.5l3 1.2-3 1.1z" fill="currentColor" stroke="none" />
      <path d="M3 17.5c1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0 1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0" />
    </svg>
  ),
  worksheets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
      <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
      <path d="M8 12h8" />
      <path d="M8 15.5h8" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 17h.01" />
    </svg>
  ),
};

export function DocFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
      <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
      <path d="M8 12h8" />
      <path d="M8 15.5h8" />
      <path d="M8 19h3" />
    </svg>
  );
}

export function DocDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function DocReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

export function DocFolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
    </svg>
  );
}

export function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="M10 5l3 3-3 3" />
      <path d="M21 16H11" />
      <path d="M14 19l-3-3 3-3" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function portLines(ports) {
  if (!ports) return [];
  return String(ports).split('\n').map((line) => line.trim()).filter(Boolean);
}

export function alertLabels(row) {
  const labels = [];
  if (row.paymentNotReceived) labels.push('Payment not Received');
  if (row.paymentNotPaid) labels.push('Payment not Paid');
  return labels;
}

export function formatLastUpdated(value) {
  if (!value) return 'Not yet updated';
  return String(value).replace(/\s+/, ' · ');
}

export function glanceStats(rows, total) {
  const uniqueVessels = new Set(rows.map((row) => row.vesselName).filter(Boolean)).size;
  const worksheets = rows.reduce((sum, row) => sum + (row.costSheets?.length || 0), 0);
  const alerts = rows.reduce((sum, row) => sum + alertLabels(row).length, 0);
  return { trades: total, vessels: uniqueVessels, worksheets, alerts };
}

export function ChipLink({ to, children }) {
  return <Link className={styles.chipLink} to={to}>{children}</Link>;
}

export function OpsVcGlanceHeader({
  stats,
  cards,
}) {
  return (
    <SummaryCardGrid>
      {cards.map((card) => (
        <SummaryCard
          key={card.title}
          title={card.title}
          value={stats[card.key]}
          variant={card.variant}
          icon={STAT_ICONS[card.icon]}
        />
      ))}
    </SummaryCardGrid>
  );
}

function HScrollButtons({ canLeft, canRight, onScroll }) {
  return (
    <div className={styles.hScrollGroup} role="group" aria-label="Scroll table">
      <button
        type="button"
        className={styles.hScrollBtn}
        aria-label="Scroll table left"
        title="Scroll left"
        disabled={!canLeft}
        onClick={() => onScroll(-1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.hScrollBtn}
        aria-label="Scroll table right"
        title="Scroll right"
        disabled={!canRight}
        onClick={() => onScroll(1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

export function OpsVcGlanceTable({
  children,
  compact = false,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  showingLabel,
}) {
  const wrapRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScroll = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 4;
    setCanLeft(overflow && el.scrollLeft > 2);
    setCanRight(overflow && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateScroll) : null;
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    window.addEventListener('resize', updateScroll);
    return () => {
      el.removeEventListener('scroll', updateScroll);
      observer?.disconnect();
      window.removeEventListener('resize', updateScroll);
    };
  }, [updateScroll, children]);

  const scrollByDir = (dir) => {
    const el = wrapRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.round(el.clientWidth * 0.5));
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.actionRowLeft}>
          <select
            className={styles.rowsSelect}
            value={pageSize}
            aria-label="Rows per page"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
          <HScrollButtons canLeft={canLeft} canRight={canRight} onScroll={scrollByDir} />
        </div>
        <div className={styles.actionRowRight}>{showingLabel}</div>
      </div>
      <div className={styles.tableCard}>
        <div className={`${styles.tableScroll} ${canLeft ? styles.fadeLeft : ''} ${canRight ? styles.fadeRight : ''}`.trim()}>
          <div className={styles.tableWrap} ref={wrapRef}>
            <table className={`${styles.grid} ${compact ? styles.gridCompact : ''}`.trim()}>
              {children}
            </table>
          </div>
        </div>
        <div className={styles.tableFooter}>
          <SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
        </div>
      </div>
    </>
  );
}

export function VoyDocsCell({
  fcaId,
  rttype,
  documentsHref,
  voyageReportHref,
}) {
  return (
    <div className={styles.docCenter}>
      <div className={styles.docGroup}>
        <Link
          className={styles.docBtn}
          to={appPath(`/internal-user/sopf/viewestimate?id=${fcaId}&rttype=${rttype}`)}
          title="View FVF (Finalised Voyage Fixture)"
        >
          <DocFileIcon />
        </Link>
        <a
          className={styles.docBtn}
          href={`/api/internal-user/sopf/estimate/${encodeURIComponent(fcaId)}/pdf`}
          title="Download Voyage Docs"
        >
          <DocDownloadIcon />
        </a>
        {voyageReportHref ? (
          <Link className={styles.docBtn} to={voyageReportHref} title="Voyage Report">
            <DocReportIcon />
          </Link>
        ) : (
          <span className={`${styles.docBtn} ${styles.docBtnDisabled}`} title="Voyage Report">
            <DocReportIcon />
          </span>
        )}
        {documentsHref ? (
          <Link className={styles.docBtn} to={documentsHref} title="Documents">
            <DocFolderIcon />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
