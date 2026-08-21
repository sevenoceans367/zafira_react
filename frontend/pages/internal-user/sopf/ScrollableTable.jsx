import React, { useCallback, useEffect, useRef, useState } from 'react';
import rightArrowIcon from '../../../assets/right_arrow.png';
import styles from './ScrollableTable.module.css';

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 50;

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
        <img
          src={rightArrowIcon}
          alt=""
          className={`${styles.hScrollIcon} ${styles.hScrollIconMirror}`}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        className={styles.hScrollBtn}
        aria-label="Scroll table right"
        title="Scroll right"
        disabled={!canRight}
        onClick={() => onScroll(1)}
      >
        <img src={rightArrowIcon} alt="" className={styles.hScrollIcon} aria-hidden="true" />
      </button>
    </div>
  );
}

function RowsPerPageSelect({
  pageSize,
  onPageSizeChange,
  options = PAGE_SIZE_OPTIONS,
}) {
  if (typeof onPageSizeChange !== 'function' || pageSize == null) return null;
  return (
    <select
      className={styles.rowsSelect}
      value={pageSize}
      aria-label="Rows per page"
      onChange={(event) => onPageSizeChange(Number(event.target.value))}
    >
      {options.map((size) => (
        <option key={size} value={size}>{size} / page</option>
      ))}
    </select>
  );
}

/**
 * Spot Ops–style horizontally scrollable table shell with ◀ ▶ controls
 * and optional rows-per-page dropdown.
 */
export default function ScrollableTable({
  children,
  toolbarLeft = null,
  toolbarRight = null,
  footer = null,
  showToolbar = true,
  className = '',
  cardClassName = '',
  /** When true, removes top radius/border so the shell can sit flush under status tabs. */
  flushTop = false,
  pageSize = null,
  onPageSizeChange = null,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
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

  const rowsSelect = (
    <RowsPerPageSelect
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      options={pageSizeOptions}
    />
  );
  const hasToolbar = showToolbar || toolbarLeft || toolbarRight || rowsSelect;

  return (
    <div className={[styles.root, flushTop ? styles.flushTop : '', className].filter(Boolean).join(' ')}>
      {hasToolbar ? (
        <div className={[styles.actionRow, flushTop ? styles.actionRowFlush : ''].filter(Boolean).join(' ')}>
          <div className={styles.actionRowLeft}>
            {rowsSelect}
            {toolbarLeft}
            <HScrollButtons canLeft={canLeft} canRight={canRight} onScroll={scrollByDir} />
          </div>
          {toolbarRight ? (
            <div className={styles.actionRowRight}>{toolbarRight}</div>
          ) : null}
        </div>
      ) : null}

      <div className={[
        styles.tableCard,
        !hasToolbar ? styles.tableCardSolo : '',
        !hasToolbar && flushTop ? styles.tableCardFlush : '',
        cardClassName,
      ].filter(Boolean).join(' ')}>
        <div className={`${styles.tableScroll} ${canLeft ? styles.fadeLeft : ''} ${canRight ? styles.fadeRight : ''}`.trim()}>
          <div className={styles.tableWrap} ref={wrapRef}>
            {children}
          </div>
        </div>
        {footer ? (
          <div className={styles.tableFooter}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export { HScrollButtons, RowsPerPageSelect };
