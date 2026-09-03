import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './CardSelect.module.css';

/**
 * Card-style dropdown — same layout as Spot Business business-type picker.
 * Menu is portaled to document.body so overflow:auto/hidden panels do not clip it.
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
  id,
  leadingDot = null,
  /** "muted" (app grey #5b6472, default) | "default" (navy — e.g. Contract Type) */
  tone = 'muted',
}) {
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

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

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const maxMenuHeight = Math.min(280, window.innerHeight * 0.5);
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < Math.min(160, maxMenuHeight) && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(maxMenuHeight, available));

    const width = Math.max(rect.width, 160);
    let left = align === 'start' ? rect.left : rect.right - width;
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8);

    if (openUp) {
      setMenuStyle({
        position: 'fixed',
        top: 'auto',
        bottom: `${window.innerHeight - rect.top + gap}px`,
        left: `${left}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 10050,
      });
      return;
    }

    setMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + gap}px`,
      bottom: 'auto',
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: 10050,
    });
  };

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    return undefined;
  }, [menuOpen, align, normalizedOptions.length]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickOutside = (event) => {
      const inTrigger = wrapRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) setMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [menuOpen, align]);

  const handleSelect = (nextValue) => {
    setMenuOpen(false);
    onChange?.(nextValue);
  };

  const menu = menuOpen && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className={styles.menuCardPortal}
        style={menuStyle}
        role="listbox"
        aria-label={ariaLabel}
      >
        {normalizedOptions.map((option) => {
          const selectedOption = option.id === String(value);
          return (
            <button
              key={option.id || '__empty'}
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
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={[
          styles.trigger,
          leadingDot ? styles.triggerWithDot : '',
          tone === 'muted' ? styles.triggerMuted : '',
        ].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {leadingDot ? (
          <span
            className={styles.leadingDot}
            style={{ background: leadingDot }}
            aria-hidden
          />
        ) : null}
        <span className={styles.triggerLabel}>{selectedLabel}</span>
        <i
          className={`bi bi-chevron-${menuOpen ? 'up' : 'down'} ${styles.chevron}`}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}
