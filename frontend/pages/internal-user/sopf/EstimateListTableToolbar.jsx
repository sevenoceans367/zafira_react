import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@bainbridge/shared-ui';
import styles from './EstimateListTableToolbar.module.css';

const DOWNLOAD_OPTIONS = [
  { id: 'csv', label: 'Download CSV', icon: '📊' },
  { id: 'pdf', label: 'Download PDF', icon: '📄' },
  { id: 'email', label: 'Email attachment', icon: '✉️' },
];

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

  return (
    <div className={styles.toolbar}>
      <div className={styles.actions}>
        <Button variant="add" label="Add" icon="plus" href={addHref} />
        <Button
          variant="sensitivity"
          label="Sensitivity Analysis"
          icon="graph-up"
          disabled={sensitivityDisabled}
          onClick={onSensitivityAnalysis}
        />
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.menuTrigger}
            aria-label="Download options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <i className="bi bi-three-dots" aria-hidden />
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
                    {option.icon}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
