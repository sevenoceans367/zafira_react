import React, { useEffect, useRef, useState } from 'react';
import DownloadIcon from '../icons/DownloadIcon.jsx';
import styles from './GridDownloadMenu.module.css';

const DEFAULT_OPTIONS = [
  { id: 'excel', label: 'Download Excel' },
  { id: 'pdf', label: 'Download PDF' },
  { id: 'email', label: 'Email Attachment' },
];

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export default function GridDownloadMenu({
  onDownloadExcel,
  onDownloadPdf,
  onEmailAttachment,
  disabled = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  const handleAction = (id) => {
    setMenuOpen(false);
    if (id === 'excel') onDownloadExcel?.();
    if (id === 'pdf') onDownloadPdf?.();
    if (id === 'email') onEmailAttachment?.();
  };

  return (
    <div className={styles.menuWrap} ref={menuRef}>
      <button
        type="button"
        className={styles.btnMore}
        aria-label="More options"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title="Download"
        disabled={disabled}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MoreIcon />
      </button>
      {menuOpen ? (
        <div className={styles.menuDropdown} role="menu">
          {DEFAULT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => handleAction(option.id)}
            >
              <span className={styles.menuIcon} aria-hidden>
                <DownloadIcon size={16} title="" />
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
