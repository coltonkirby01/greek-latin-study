export type TimerLedger = { accumulatedMs: number; startedAt: number | null };
export function blankTimerLedger(): TimerLedger { return { accumulatedMs: 0, startedAt: null }; }
export function readTimer(ledger: TimerLedger, now: number) { return ledger.accumulatedMs + (ledger.startedAt === null ? 0 : Math.max(0, now - ledger.startedAt)); }
export function resumeTimer(ledger: TimerLedger, now: number): TimerLedger { return ledger.startedAt === null ? { ...ledger, startedAt: now } : ledger; }
export function pauseTimer(ledger: TimerLedger, now: number): TimerLedger { return ledger.startedAt === null ? ledger : { accumulatedMs: readTimer(ledger, now), startedAt: null }; }
