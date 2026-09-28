import { useEffect, useLayoutEffect, useRef } from 'react';

const BUSINESS_TYPE_KEY = 'opsVc.selBType';
const SCROLL_PREFIX = 'opsVc.scroll.';

function readStored(key) {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStored(key, value) {
  try {
    if (value == null || value === '') sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    // Ignore private-mode storage failures.
  }
}

/** Spot Ops Tanker / Gas / Dry. URL wins; otherwise restore the last choice after Back. */
export function readOpsVcBusinessType(searchParams) {
  const fromUrl = searchParams.get('selBType');
  if (fromUrl) {
    writeStored(BUSINESS_TYPE_KEY, fromUrl);
    return fromUrl;
  }
  return readStored(BUSINESS_TYPE_KEY) || '2';
}

export function rememberOpsVcBusinessType(value) {
  writeStored(BUSINESS_TYPE_KEY, value);
}

function findSpotScroller() {
  const shell = document.querySelector('.internal-user-shell');
  let node = shell?.parentElement || null;
  while (node && node !== document.body) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node;
    }
    node = node.parentElement;
  }
  return document.querySelector('main') || document.scrollingElement || document.documentElement;
}

const HSCROLL_SUFFIX = ':x';

function findHScroller() {
  return document.querySelector('[data-ops-hscroll]');
}

function rememberOpsVcHScroll(tab, left) {
  if (!tab || !Number.isFinite(left)) return;
  writeStored(`${SCROLL_PREFIX}${tab}${HSCROLL_SUFFIX}`, String(Math.max(0, Math.round(left))));
}

function restoreOpsVcHScroll(tab) {
  const left = Number(readStored(`${SCROLL_PREFIX}${tab}${HSCROLL_SUFFIX}`));
  if (!Number.isFinite(left) || left <= 0) return;
  const apply = () => {
    const el = findHScroller();
    if (el) el.scrollLeft = left;
  };
  apply();
  requestAnimationFrame(apply);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 200);
  window.setTimeout(apply, 500);
}
function rememberOpsVcScroll(tab, top) {
  if (!tab || !Number.isFinite(top)) return;
  writeStored(`${SCROLL_PREFIX}${tab}`, String(Math.max(0, Math.round(top))));
}

function restoreOpsVcScroll(tab) {
  const top = Number(readStored(`${SCROLL_PREFIX}${tab}`));
  if (!Number.isFinite(top) || top <= 0) return;
  const apply = () => {
    const el = findSpotScroller();
    if (el) el.scrollTop = top;
  };
  apply();
  requestAnimationFrame(apply);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 200);
  window.setTimeout(apply, 500);
}

/** Remember Spot Ops list scroll per tab, and restore it after the list has loaded. */
export function useOpsVcScrollRestore(tab, ready) {
  const restoredRef = useRef(false);
  const armedRef = useRef(false);
  const latestRef = useRef(0);
  const latestLeftRef = useRef(0);

  useEffect(() => {
    const el = findSpotScroller();
    const hEl = findHScroller();
    if (!el && !hEl) return undefined;

    const snapshot = () => {
      if (el) {
        const live = el.scrollTop;
        const top = live > 0 ? live : latestRef.current;
        if (top > 0) {
          latestRef.current = top;
          rememberOpsVcScroll(tab, top);
        }
      }
      if (hEl) {
        const liveLeft = hEl.scrollLeft;
        const left = liveLeft > 0 ? liveLeft : latestLeftRef.current;
        if (left > 0) {
          latestLeftRef.current = left;
          rememberOpsVcHScroll(tab, left);
        }
      }
    };

    const onScroll = () => {
      if (!armedRef.current || !el) return;
      if (el.scrollTop === 0 && latestRef.current > 80) return;
      latestRef.current = el.scrollTop;
      rememberOpsVcScroll(tab, el.scrollTop);
    };

    const onHScroll = () => {
      if (!armedRef.current || !hEl) return;
      if (hEl.scrollLeft === 0 && latestLeftRef.current > 40) return;
      latestLeftRef.current = hEl.scrollLeft;
      rememberOpsVcHScroll(tab, hEl.scrollLeft);
    };

    el?.addEventListener('scroll', onScroll, { passive: true });
    hEl?.addEventListener('scroll', onHScroll, { passive: true });
    document.addEventListener('pointerdown', snapshot, true);
    return () => {
      snapshot();
      el?.removeEventListener('scroll', onScroll);
      hEl?.removeEventListener('scroll', onHScroll);
      document.removeEventListener('pointerdown', snapshot, true);
    };
  }, [tab, ready]);

  useLayoutEffect(() => {
    if (!ready || restoredRef.current) return undefined;
    restoredRef.current = true;
    restoreOpsVcScroll(tab);
    restoreOpsVcHScroll(tab);
    const timer = window.setTimeout(() => {
      armedRef.current = true;
    }, 600);
    return () => window.clearTimeout(timer);
  }, [ready, tab]);
}
