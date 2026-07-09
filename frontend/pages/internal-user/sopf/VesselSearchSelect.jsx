import React, { useEffect, useRef, useState } from 'react';
import { searchVessels } from '../../../services/estimateDetail.js';
import styles from './VesselSearchSelect.module.css';

export default function VesselSearchSelect({ value, label, onSelect }) {
  const [query, setQuery] = useState(label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(label || '');
  }, [label, value]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchVessels(term);
        setResults(rows);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handlePick = (vessel) => {
    setQuery(vessel.name);
    setOpen(false);
    onSelect?.(vessel);
  };

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
          if (results.length) setOpen(true);
        }}
      />
      {open && (results.length > 0 || loading) ? (
        <ul className={styles.dropdown} role="listbox">
          {loading ? (
            <li className={styles.empty}>Searching...</li>
          ) : null}
          {!loading && results.length === 0 ? (
            <li className={styles.empty}>No vessels found</li>
          ) : null}
          {!loading
            ? results.map((vessel) => (
              <li key={vessel.id}>
                <button
                  type="button"
                  className={styles.option}
                  role="option"
                  aria-selected={value === vessel.id}
                  onClick={() => handlePick(vessel)}
                >
                  {vessel.name}
                </button>
              </li>
            ))
            : null}
        </ul>
      ) : null}
    </div>
  );
}
