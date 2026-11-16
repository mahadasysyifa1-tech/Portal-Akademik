import { useEffect } from 'react';

const DEFAULT_RING_CLASSES = ['ring-4', 'ring-indigo-500', 'ring-offset-2'];

/**
 * Smoothly scrolls to a deep-linked directory card and temporarily highlights it,
 * cleaning up both outer and inner timers on unmount or target change.
 */
export function useCardHighlight(
  targetId: string | null | undefined,
  idPrefix: string,
  ringClasses: string[] = DEFAULT_RING_CLASSES,
  durationMs = 2500
): void {
  const ringKey = ringClasses.join(' ');

  useEffect(() => {
    if (!targetId) return;

    let innerTimer: ReturnType<typeof setTimeout> | undefined;
    let highlightedEl: HTMLElement | null = null;
    const classes = ringKey.split(' ').filter(Boolean);

    const outerTimer = setTimeout(() => {
      const el = document.getElementById(`${idPrefix}${targetId}`);
      if (!el) return;

      highlightedEl = el;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(...classes);

      innerTimer = setTimeout(() => {
        el.classList.remove(...classes);
      }, durationMs);
    }, 120);

    return () => {
      clearTimeout(outerTimer);
      if (innerTimer) clearTimeout(innerTimer);
      if (highlightedEl) {
        highlightedEl.classList.remove(...classes);
      }
    };
  }, [targetId, idPrefix, ringKey, durationMs]);
}
