import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './CountryMultiSelect.module.css';

export default function CountryMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Choose countries…',
  searchPlaceholder = 'Search…',
  disabled = false,
  compact = false,
}) {
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const selected = value.map(String);

  const selectedOptions = useMemo(
    () => options.filter((item) => selected.includes(String(item.id))),
    [options, selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [options, query]);

  const updateMenuPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, compact ? 180 : 160);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      zIndex: 10050,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, compact]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const inRoot = rootRef.current?.contains(event.target);
      const inDropdown = dropdownRef.current?.contains(event.target);
      if (!inRoot && !inDropdown) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const toggleId = (id) => {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    onChange(next);
  };

  const removeId = (id) => {
    onChange(selected.filter((item) => item !== id));
  };

  const dropdown = open && menuStyle ? createPortal(
    <div
      ref={dropdownRef}
      className={`${styles.dropdown} ${styles.dropdownPortal} ${compact ? styles.compactDropdown : ''}`}
      style={menuStyle}
      role="listbox"
      aria-multiselectable="true"
    >
      <input
        className={styles.search}
        type="search"
        value={query}
        placeholder={searchPlaceholder}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        onClick={(event) => event.stopPropagation()}
      />
      <ul className={styles.options}>
        {filtered.length === 0 ? (
          <li className={styles.empty}>No matches found.</li>
        ) : (
          filtered.map((item) => {
            const id = String(item.id);
            const checked = selected.includes(id);
            return (
              <li key={id}>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    className={styles.optionCheck}
                    checked={checked}
                    onChange={() => toggleId(id)}
                  />
                  <span className={styles.optionLabel}>{item.name}</span>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''}`} ref={rootRef}>
      <button
        type="button"
        className={styles.control}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selectedOptions.map((item) => item.name).join(', ')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className={styles.chips}>
          {selectedOptions.length === 0 ? (
            <span className={styles.placeholder}>{placeholder}</span>
          ) : (
            selectedOptions.map((item) => (
              <span key={item.id} className={styles.chip}>
                <span className={styles.chipLabel}>{item.name}</span>
                {!disabled ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className={styles.chipRemove}
                    aria-label={`Remove ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeId(String(item.id));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        removeId(String(item.id));
                      }
                    }}
                  >
                    ×
                  </span>
                ) : null}
              </span>
            ))
          )}
        </div>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} ${styles.chevron}`} aria-hidden />
      </button>
      {dropdown}
    </div>
  );
}
