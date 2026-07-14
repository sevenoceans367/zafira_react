import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchVessels } from '../../../services/estimateDetail.js';
import styles from './VesselSearchSelect.module.css';

export default function VesselSearchSelect({ value, label, onSelect }) {
  const [query, setQuery] = useState(label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

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
      const width = Math.max(rect.width, 260);
      const maxHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const openUp = spaceBelow < 140 && rect.top > spaceBelow;
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
    if (term.length < 2) {
      setResults([]);
      setError('');
      return undefined;
    }

    // Don't re-query while the field still shows the already-selected vessel.
    if (value && label && term === String(label).trim()) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await searchVessels(term);
        setResults(Array.isArray(rows) ? rows : []);
        setOpen(true);
      } catch (err) {
        setResults([]);
        setError(err.message || 'Failed to search vessels.');
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, value, label]);

  const handlePick = (vessel) => {
    setQuery(vessel.name || vessel.vesselName || '');
    setResults([]);
    setOpen(false);
    onSelect?.(vessel);
  };

  const showMenu = open && menuStyle && (loading || error || results.length > 0 || query.trim().length >= 2);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id="vesselName"
        type="text"
        value={query}
        placeholder="Search vessel name or IMO"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          if (!event.target.value.trim()) {
            onSelect?.(null);
          }
        }}
        onFocus={() => {
          if (results.length || query.trim().length >= 2) setOpen(true);
        }}
      />
      {showMenu
        ? createPortal(
          <ul
            ref={menuRef}
            className={styles.dropdownFixed}
            style={menuStyle}
            role="listbox"
          >
            {loading ? <li className={styles.empty}>Searching…</li> : null}
            {!loading && error ? <li className={styles.empty}>{error}</li> : null}
            {!loading && !error && results.length === 0 ? (
              <li className={styles.empty}>No vessels found</li>
            ) : null}
            {!loading && !error
              ? results.map((vessel) => (
                <li key={vessel.id}>
                  <button
                    type="button"
                    className={styles.option}
                    role="option"
                    aria-selected={String(value) === String(vessel.id)}
                    onClick={() => handlePick(vessel)}
                  >
                    {vessel.name || vessel.vesselName}
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
