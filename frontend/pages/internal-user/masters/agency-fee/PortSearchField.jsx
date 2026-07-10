import React, { useEffect, useRef, useState } from 'react';
import { searchMasterPorts } from '../../../../services/agencyFeeRecords.js';
import styles from './PortSearchField.module.css';

export default function PortSearchField({
  value,
  label,
  onChange,
  required = false,
  placeholder = 'Search port…',
}) {
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
    if (term.length < 1) {
      setResults([]);
      return undefined;
    }

    // Avoid re-querying when the input still shows the selected port label.
    if (value && label && term === String(label).trim()) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchMasterPorts(term);
        setResults(rows);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, value, label]);

  const handleSelect = (port) => {
    onChange(port.id, port.name);
    setQuery(port.name);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        type="text"
        className={styles.input}
        value={query}
        required={required}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!event.target.value) onChange('', '');
        }}
        onFocus={() => {
          if (results.length) setOpen(true);
        }}
      />
      {loading ? <span className={styles.hint}>Searching…</span> : null}
      {open && results.length > 0 ? (
        <ul className={styles.dropdown}>
          {results.map((port) => (
            <li key={port.id}>
              <button type="button" onClick={() => handleSelect(port)}>
                {port.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
