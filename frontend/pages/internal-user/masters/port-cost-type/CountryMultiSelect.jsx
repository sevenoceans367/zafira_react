import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './CountryMultiSelect.module.css';

export default function CountryMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Choose countries…',
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
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

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.control}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className={styles.chips}>
          {selectedOptions.length === 0 ? (
            <span className={styles.placeholder}>{placeholder}</span>
          ) : (
            selectedOptions.map((item) => (
              <span key={item.id} className={styles.chip}>
                {item.name}
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
              </span>
            ))
          )}
        </div>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'} ${styles.chevron}`} aria-hidden />
      </button>

      {open ? (
        <div className={styles.dropdown} role="listbox" aria-multiselectable="true">
          <input
            className={styles.search}
            type="search"
            value={query}
            placeholder="Search countries…"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onClick={(event) => event.stopPropagation()}
          />
          <ul className={styles.options}>
            {filtered.length === 0 ? (
              <li className={styles.empty}>No countries found.</li>
            ) : (
              filtered.map((item) => {
                const id = String(item.id);
                const checked = selected.includes(id);
                return (
                  <li key={id}>
                    <label className={styles.option}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleId(id)}
                      />
                      <span>{item.name}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
