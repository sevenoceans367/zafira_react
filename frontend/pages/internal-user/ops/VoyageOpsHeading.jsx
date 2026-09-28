import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import styles from './VoyageOpsHeading.module.css';

const ANCHOR_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="3" />
    <path d="M12 22V8" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
);

/** Contract Finance page heading: title, then grey VOY · vessel chip. */
export default function VoyageOpsHeading({
  title,
  voyageNo = '',
  vesselName = '',
  worksheetHref = '',
}) {
  const setHeading = usePageHeaderHeading();
  useEffect(() => {
    const hasVoyage = Boolean(voyageNo || vesselName);
    const voyLabel = voyageNo ? `VOY ${voyageNo}` : 'VOY —';
    setHeading({
      title: (
        <span className={styles.headerTitleStack}>
          <span className={styles.headerTitleText}>{title}</span>
          {hasVoyage ? (
            <span className={styles.headerVoyageChip}>
              {ANCHOR_ICON}
              {worksheetHref && voyageNo ? (
                <Link to={worksheetHref} className={styles.headerVoyLink} title="Open latest voyage worksheet">
                  {voyLabel}
                </Link>
              ) : voyLabel}
              {vesselName ? (
                <>
                  <span className={styles.vcSep}>·</span>
                  {vesselName}
                </>
              ) : null}
            </span>
          ) : null}
        </span>
      ),
    });
  }, [setHeading, title, voyageNo, vesselName, worksheetHref]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}
