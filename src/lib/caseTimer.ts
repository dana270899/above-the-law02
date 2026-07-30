export interface CaseTimerState {
  accumulatedMs: number
  activeSinceMs: number | null
  frozenMs: number | null
}

export type CaseTimers = Record<string, CaseTimerState>

function timerFor(timers: CaseTimers, caseId: string): CaseTimerState {
  return timers[caseId] ?? {
    accumulatedMs: 0,
    activeSinceMs: null,
    frozenMs: null,
  }
}

export function resumeCaseTimer(
  timers: CaseTimers,
  caseId: string,
  nowMs: number,
): void {
  const timer = timerFor(timers, caseId)
  timers[caseId] = timer
  if (timer.frozenMs != null || timer.activeSinceMs != null) return
  timer.activeSinceMs = nowMs
}

export function pauseCaseTimer(
  timers: CaseTimers,
  caseId: string,
  nowMs: number,
): void {
  const timer = timerFor(timers, caseId)
  timers[caseId] = timer
  if (timer.frozenMs != null || timer.activeSinceMs == null) return
  timer.accumulatedMs += Math.max(0, nowMs - timer.activeSinceMs)
  timer.activeSinceMs = null
}

export function freezeCaseTimer(
  timers: CaseTimers,
  caseId: string,
  nowMs: number,
): number {
  const timer = timerFor(timers, caseId)
  timers[caseId] = timer
  if (timer.frozenMs == null) {
    pauseCaseTimer(timers, caseId, nowMs)
    timer.frozenMs = timer.accumulatedMs
  }
  return timer.frozenMs / 1000
}

export function getCaseElapsedSeconds(
  timers: CaseTimers,
  caseId: string,
  nowMs: number,
): number {
  const timer = timerFor(timers, caseId)
  const elapsedMs = timer.frozenMs
    ?? timer.accumulatedMs + (
      timer.activeSinceMs == null ? 0 : Math.max(0, nowMs - timer.activeSinceMs)
    )
  return elapsedMs / 1000
}
