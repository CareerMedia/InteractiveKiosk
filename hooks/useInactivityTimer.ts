import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseInactivityTimerOptions {
  active: boolean;
  timeoutMs: number;
  onTimeout: () => void;
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'pointermove',
  'touchstart',
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'scroll',
];

export function useInactivityTimer({
  active,
  timeoutMs,
  onTimeout,
}: UseInactivityTimerOptions) {
  const timeoutRef = useRef<number | null>(null);
  const expiresAtRef = useRef<number>(Date.now() + timeoutMs);
  const onTimeoutRef = useRef(onTimeout);
  const [timeRemainingMs, setTimeRemainingMs] = useState(timeoutMs);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clearExistingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (!active) {
      return;
    }

    clearExistingTimeout();
    expiresAtRef.current = Date.now() + timeoutMs;
    setTimeRemainingMs(timeoutMs);

    timeoutRef.current = window.setTimeout(() => {
      onTimeoutRef.current();
    }, timeoutMs);
  }, [active, clearExistingTimeout, timeoutMs]);

  useEffect(() => {
    if (!active) {
      clearExistingTimeout();
      setTimeRemainingMs(timeoutMs);
      return;
    }

    reset();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, reset, { passive: true }));

    const intervalId = window.setInterval(() => {
      const remaining = Math.max(expiresAtRef.current - Date.now(), 0);
      setTimeRemainingMs(remaining);
    }, 250);

    return () => {
      clearExistingTimeout();
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, reset));
      window.clearInterval(intervalId);
    };
  }, [active, clearExistingTimeout, reset, timeoutMs]);

  return useMemo(
    () => ({
      reset,
      secondsRemaining: Math.ceil(timeRemainingMs / 1000),
      timeRemainingMs,
    }),
    [reset, timeRemainingMs],
  );
}
