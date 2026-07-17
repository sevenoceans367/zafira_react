import React, { useEffect, useRef, useState } from 'react';
import styles from './CardSelect.module.css';

/**
 * Card-style dropdown — same layout as Spot Business business-type picker.
 * options: [{ id, name }] or [{ value, label }]
 */
export default function CardSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select type',
  ariaLabel = 'Select option',
  align = 'end',
  disabled = false,
}) {
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const normalizedOptions = options.map((option) => ({
    id: String(option.id ?? option.value ?? ''),
    name: option.name ?? option.label ?? '',
  }));

  const valueId = value == null || value === '' ? '' : String(value);
  let selected = normalizedOptions.find((option) => option.id === valueId);
  // Keep edit selection visible even if lookup list is missing that id (inactive / filtered).
  if (!selected && valueId) {
    selected = { id: valueId, name: valueId };
    normalizedOptions.unshift(selected);
  }
  const selectedLabel = selected?.name || placeholder;

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const handleSelect = (nextValue) => {
    setMenuOpen(false);
    onChange?.(nextValue);
  };

  return (
    <div className={styles.wrap} ref={menuRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span>{selectedLabel}</span>
        <i
          className={`bi bi-chevron-${menuOpen ? 'up' : 'down'} ${styles.chevron}`}
          aria-hidden
        />
      </button>

      {menuOpen ? (
        <div
          className={`${styles.menuCard} ${align === 'start' ? styles.menuAlignStart : ''}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {normalizedOptions.map((option) => {
            const selectedOption = option.id === String(value);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selectedOption}
                className={`${styles.menuItem} ${selectedOption ? styles.menuItemSelected : ''}`}
                onClick={() => handleSelect(option.id)}
              >
                <span>{option.name}</span>
                {selectedOption ? <i className={`bi bi-check2 ${styles.check}`} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
