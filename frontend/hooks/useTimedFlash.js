import { useEffect, useRef, useState } from 'react';

export const FLASH_AUTO_DISMISS_MS = 2000;

function isErrorFlash(flash) {
  if (flash == null || flash === '') return false;
  return typeof flash === 'object' && flash.type === 'error';
}

function emptyFor(flash) {
  return typeof flash === 'string' ? '' : null;
}

function flashIdentity(flash) {
  if (flash == null || flash === '') return '';
  if (typeof flash === 'string') return `str:${flash}`;
  return `${flash.type || ''}:${flash.text || ''}`;
}

/**
 * Drop-in for `useState(null)` / `useState('')` flash banners.
 * Success (and plain string) messages clear after 2s; error flashes stay.
 */
export function useFlashState(initial = null, delayMs = FLASH_AUTO_DISMISS_MS) {
  const [flash, setFlash] = useState(initial);

  useEffect(() => {
    if (flash == null || flash === '' || isErrorFlash(flash)) return undefined;
    const timer = window.setTimeout(() => setFlash(emptyFor(initial)), delayMs);
    return () => window.clearTimeout(timer);
  }, [flash, delayMs, initial]);

  return [flash, setFlash];
}

/**
 * Wrap a derived/URL flash value. Hides success after 2s; optional onDismiss
 * (e.g. clear `?msg=` from the query string).
 */
export default function useTimedFlash(flash, { delayMs = FLASH_AUTO_DISMISS_MS, onDismiss } = {}) {
  const [hiddenId, setHiddenId] = useState('');
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const id = flashIdentity(flash);

  useEffect(() => {
    if (!flash || flash === '' || isErrorFlash(flash)) return undefined;
    const timer = window.setTimeout(() => {
      setHiddenId(id);
      onDismissRef.current?.();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [id, delayMs, flash]);

  if (!flash || flash === '') return emptyFor(flash ?? null);
  if (hiddenId === id) return emptyFor(flash);
  return flash;
}
