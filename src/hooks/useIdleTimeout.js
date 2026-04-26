import { useEffect, useRef, useCallback } from 'react';

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'scroll', 'touchstart', 'click', 'wheel',
];

/**
 * Calls `onIdle` after `idleMs` of no user activity.
 * Calls `onWarn` after `(idleMs - warnMs)` to give an advance warning.
 * Both are reset whenever the user does anything.
 *
 * Returns a `reset` function so a "Stay logged in" button can manually reset the timer.
 */
const useIdleTimeout = ({ onIdle, onWarn, idleMs = 120_000, warnMs = 15_000 }) => {
  const idleTimer  = useRef(null);
  const warnTimer  = useRef(null);

  const clearTimers = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    warnTimer.current = setTimeout(onWarn, idleMs - warnMs);
    idleTimer.current = setTimeout(onIdle, idleMs);
  }, [clearTimers, onIdle, onWarn, idleMs, warnMs]);

  useEffect(() => {
    // Start timers on mount
    reset();

    // Re-start on any user activity
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [reset, clearTimers]);

  return { reset };
};

export default useIdleTimeout;
