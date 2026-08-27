import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import styles from './OpsVcInOpsGlancePage.module.css';

const WIDGET_ICONS = {
  freight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  ),
  pda: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
    </svg>
  ),
  laytime: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
};

const WIDGETS = [
  {
    key: 'freight',
    title: 'Freight Invoices Due',
    subtitle: (count) => `${count} voyage${count === 1 ? '' : 's'} with a freight invoice awaiting action`,
    variant: 'fin',
  },
  {
    key: 'pda',
    title: 'PDA Received',
    subtitle: (count) => `${count} voyage${count === 1 ? '' : 's'} with a PDA in from the agent, ready for review`,
    variant: 'cnt',
  },
  {
    key: 'laytime',
    title: 'Laytime Due',
    subtitle: (count) => `${count} voyage${count === 1 ? '' : 's'} with laytime calculation outstanding`,
    variant: 'fin',
  },
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function variantClass(variant) {
  if (variant === 'fin') return styles.taskWidgetFin;
  return styles.taskWidgetCnt;
}

function modalIcoClass(variant) {
  return variant === 'fin' ? styles.widgetModalIcoFin : '';
}

function voyageHref(row, pageContext, kind) {
  if (!row?.comId) return null;
  const com = encodeURIComponent(row.comId);
  const page = encodeURIComponent(pageContext);
  if (kind === 'freight') {
    return appPath(`/internal-user/vc/ops/payment-grid?comid=${com}&page=${page}`);
  }
  if (kind === 'pda') {
    return appPath(`/internal-user/vc/ops/pda-fda?comid=${com}&page=${page}`);
  }
  return appPath(`/internal-user/vc/ops/laytime?comid=${com}&page=${page}`);
}

function buildWidgetItems(kind, rows, pageContext) {
  if (kind === 'freight') {
    return rows
      .filter((row) => row.paymentNotReceived)
      .map((row) => ({
        key: row.comId,
        id: row.voyageNo || row.message || '—',
        detail: [row.vesselName, row.charterer].filter(Boolean).join(' · ') || '—',
        due: row.cpDate ? `CP ${row.cpDate}` : 'Due',
        href: voyageHref(row, pageContext, 'freight'),
      }));
  }
  if (kind === 'pda') {
    return rows
      .filter((row) => row.pdaReceived)
      .map((row) => ({
        key: row.comId,
        id: row.voyageNo || row.message || '—',
        detail: [row.vesselName, row.ports].filter(Boolean).join(' · ') || '—',
        due: 'PDA received',
        href: voyageHref(row, pageContext, 'pda'),
      }));
  }
  return rows
    .filter((row) => row.laytimeDue)
    .map((row) => ({
      key: row.comId,
      id: row.voyageNo || row.message || '—',
      detail: [row.vesselName, row.ports].filter(Boolean).join(' · ') || '—',
      due: 'Laytime due',
      href: voyageHref(row, pageContext, 'laytime'),
    }));
}

function widgetStats(rows) {
  return {
    freight: rows.filter((row) => row.paymentNotReceived).length,
    pda: rows.filter((row) => row.pdaReceived).length,
    laytime: rows.filter((row) => row.laytimeDue).length,
  };
}

/**
 * Spot Ops action widgets from Spot_Operations_6 — same chrome / modal as TC Ops.
 */
export default function OpsVcTaskWidgets({ rows = [], pageContext = 1 }) {
  const [widgetModal, setWidgetModal] = useState(null);
  const stats = useMemo(() => widgetStats(rows), [rows]);
  const activeWidget = WIDGETS.find((widget) => widget.key === widgetModal) || null;
  const widgetItems = useMemo(
    () => (widgetModal ? buildWidgetItems(widgetModal, rows, pageContext) : []),
    [widgetModal, rows, pageContext],
  );

  return (
    <>
      <div className={`${styles.widgetRow} ${styles.widgetRowThree}`}>
        {WIDGETS.map((widget) => {
          const count = stats[widget.key] ?? 0;
          return (
            <button
              key={widget.key}
              type="button"
              className={`${styles.taskWidget} ${variantClass(widget.variant)}`}
              onClick={() => setWidgetModal(widget.key)}
            >
              <span className={styles.twIcon}>{WIDGET_ICONS[widget.key]}</span>
              <span className={styles.twBody}>
                <span className={styles.twCount}>{count}</span>
                <span className={styles.twLabel}>{widget.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      {activeWidget ? (
        <div
          className={styles.widgetOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="spot-ops-widget-title"
          onClick={() => setWidgetModal(null)}
        >
          <div
            className={styles.widgetModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.widgetModalHead}>
              <div className={styles.widgetModalTitleWrap}>
                <div className={`${styles.widgetModalIco} ${modalIcoClass(activeWidget.variant)}`}>
                  {WIDGET_ICONS[activeWidget.key]}
                </div>
                <div>
                  <div id="spot-ops-widget-title" className={styles.widgetModalTitle}>
                    {activeWidget.title}
                  </div>
                  <div className={styles.widgetModalSubtitle}>
                    {activeWidget.subtitle(widgetItems.length)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.widgetClose}
                onClick={() => setWidgetModal(null)}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.widgetModalBody}>
              {widgetItems.length ? (
                <div className={styles.widgetList}>
                  {widgetItems.map((item) => (
                    item.href ? (
                      <Link
                        key={item.key}
                        className={styles.widgetListItem}
                        to={item.href}
                        onClick={() => setWidgetModal(null)}
                      >
                        <span className={styles.wliId}>{item.id}</span>
                        <span className={styles.wliDetail}>{item.detail}</span>
                        <span className={styles.wliDue}>{item.due}</span>
                      </Link>
                    ) : (
                      <div key={item.key} className={styles.widgetListItem}>
                        <span className={styles.wliId}>{item.id}</span>
                        <span className={styles.wliDetail}>{item.detail}</span>
                        <span className={styles.wliDue}>{item.due}</span>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className={styles.widgetEmpty}>No matching voyages on this page.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
