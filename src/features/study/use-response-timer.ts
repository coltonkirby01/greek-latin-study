import { useCallback, useEffect, useRef, useState } from "react";
import { blankTimerLedger, pauseTimer, readTimer, resumeTimer } from "./timer-ledger";

export function useResponseTimer(timerKey: string | null, active: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const ledger = useRef(blankTimerLedger());
  const activeRef = useRef(active);

  const value = useCallback(() => readTimer(ledger.current, performance.now()), []);
  const pause = useCallback(() => {
    ledger.current = pauseTimer(ledger.current, performance.now());
    setElapsedMs(ledger.current.accumulatedMs);
  }, []);
  const resume = useCallback(() => {
    if (activeRef.current && document.visibilityState === "visible" && document.hasFocus()) {
      ledger.current = resumeTimer(ledger.current, performance.now());
    }
  }, []);

  useEffect(() => {
    ledger.current = blankTimerLedger();
    setElapsedMs(0);
    activeRef.current = active;
    if (active && document.visibilityState === "visible" && document.hasFocus()) {
      ledger.current = resumeTimer(ledger.current, performance.now());
    }
  }, [timerKey]);

  useEffect(() => {
    activeRef.current = active;
    if (active) resume();
    else pause();
  }, [active, pause, resume]);

  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pause]);

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setElapsedMs(value()), 10);
    return () => window.clearInterval(interval);
  }, [active, value]);

  const capture = useCallback(() => {
    const result = value();
    pause();
    setElapsedMs(result);
    return result;
  }, [pause, value]);

  return { elapsedMs, capture };
}
