import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchPeriodContractPorts } from '../../../services/periodContracts.js';
import styles from './PortSearchSelect.module.css';

export default function PortSearchSelect({
  value,
  label,
  onChange,
  required = false,
  placeholder = 'Search port…',
  id,
  /** Show × to clear the selected port (default true). */
  clearable = true,
  /** Optional async (query) => [{ id, name }] — defaults to period-contract local search */
  searchPorts,
}) {
  const [query, setQuery] = useState(label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const searchFn = searchPorts || searchPeriodContractPorts;

  useEffect(() => {
    setQuery(label || '');
  }, [label, value]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 220);
      const maxHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const openUp = spaceBelow < 120 && rect.top > spaceBelow;
      setMenuStyle({
        position: 'fixed',
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        maxHeight,
        zIndex: 10050,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, results, loading]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      const inWrap = wrapRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (!inWrap && !inMenu) setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      return undefined;
    }

    // Don't re-query while the field still shows the already-selected port.
    if (value && label && term === String(label).trim()) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchFn(term);
        setResults(Array.isArray(rows) ? rows : []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, value, label, searchFn]);

  const handleSelect = (port) => {
    onChange?.(port.id, port.name);
    setQuery(port.name);
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange?.('', '');
  };

  const showClear = clearable && !!(value || query);
  const showMenu = open && menuStyle && (loading || results.length > 0 || query.trim().length > 0);

  return (
    <div className={styles.wrap} ref={wrapRef} data-estimate-field-wrap={id || undefined}>
      <input
        id={id}
        type="text"
        className={[styles.input, showClear ? styles.inputWithClear : ''].filter(Boolean).join(' ')}
        value={query}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          if (!event.target.value) onChange?.('', '');
        }}
        onFocus={() => {
          if (results.length || query.trim().length >= 1) setOpen(true);
        }}
      />
      {showClear ? (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
          title="Clear port"
          aria-label="Clear port"
        >
          ×
        </button>
      ) : null}
      {showMenu
        ? createPortal(
          <ul
            ref={menuRef}
            className={styles.dropdownFixed}
            style={menuStyle}
            role="listbox"
          >
            {loading ? <li className={styles.hintItem}>Searching…</li> : null}
            {!loading && results.length === 0 ? (
              <li className={styles.hintItem}>No ports found</li>
            ) : null}
            {!loading
              ? results.map((port) => (
                <li key={port.id}>
                  <button type="button" onClick={() => handleSelect(port)}>
                    {port.name}
                  </button>
                </li>
              ))
              : null}
          </ul>,
          document.body,
        )
        : null}
    </div>
  );
}
