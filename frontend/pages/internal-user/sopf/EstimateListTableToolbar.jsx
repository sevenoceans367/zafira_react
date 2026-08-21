import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DownloadIcon } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import styles from './EstimateListTableToolbar.module.css';

const DOWNLOAD_OPTIONS = [
  { id: 'csv', label: 'Download CSV' },
  { id: 'pdf', label: 'Download PDF' },
  { id: 'email', label: 'Email attachment' },
];

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SensitivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M8 19v-7" />
      <path d="M12 19V9" />
      <path d="M16 19v-4" />
      <path d="M20 19V6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export default function EstimateListTableToolbar({
  addHref,
  onSensitivityAnalysis,
  sensitivityDisabled = false,
  onDownloadCsv,
  onDownloadPdf,
  onEmailAttachment,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const sensitivityEnabled = !sensitivityDisabled;

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleDownloadAction = (id) => {
    setMenuOpen(false);
    switch (id) {
      case 'csv':
        onDownloadCsv?.();
        break;
      case 'pdf':
        onDownloadPdf?.();
        break;
      case 'email':
        onEmailAttachment?.();
        break;
      default:
        break;
    }
  };

  const resolvedAddHref = addHref?.startsWith('/') && !addHref.startsWith('http')
    ? appPath(addHref)
    : addHref;

  return (
    <div className={styles.actionRow}>
      <Link className={styles.btnAdd} to={resolvedAddHref}>
        <PlusIcon />
        Add
      </Link>
      <button
        type="button"
        className={`${styles.btnSensitivity} ${sensitivityEnabled ? styles.btnSensitivityEnabled : ''}`}
        disabled={sensitivityDisabled}
        title={sensitivityEnabled ? 'Open Sensitivity Analysis for selected estimates' : 'Select a row to enable'}
        onClick={onSensitivityAnalysis}
      >
        <SensitivityIcon />
        Sensitivity Analysis
      </button>
      <div className={styles.menuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.btnMore}
          aria-label="More options"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreIcon />
        </button>
        {menuOpen ? (
          <div className={styles.menuDropdown} role="menu">
            {DOWNLOAD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => handleDownloadAction(option.id)}
              >
                <span>{option.label}</span>
                <span className={styles.menuIcon} aria-hidden>
                  <DownloadIcon size={16} title="" />
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
