import { describe, expect, it } from 'vitest'
import {
  freezeCaseTimer,
  getCaseElapsedSeconds,
  pauseCaseTimer,
  resumeCaseTimer,
  type CaseTimers,
} from './caseTimer'

describe('case bonus timer', () => {
  it('counts only active case time across pauses and returns', () => {
    const timers: CaseTimers = {}
    resumeCaseTimer(timers, 'a', 1_000)
    pauseCaseTimer(timers, 'a', 4_000)
    expect(getCaseElapsedSeconds(timers, 'a', 20_000)).toBe(3)

    resumeCaseTimer(timers, 'a', 20_000)
    expect(freezeCaseTimer(timers, 'a', 22_000)).toBe(5)
  })

  it('pauses one case while another case is active', () => {
    const timers: CaseTimers = {}
    resumeCaseTimer(timers, 'a', 0)
    pauseCaseTimer(timers, 'a', 2_000)
    resumeCaseTimer(timers, 'b', 2_000)
    pauseCaseTimer(timers, 'b', 7_000)
    resumeCaseTimer(timers, 'a', 7_000)

    expect(freezeCaseTimer(timers, 'a', 8_000)).toBe(3)
    expect(freezeCaseTimer(timers, 'b', 8_000)).toBe(5)
  })

  it('freezes permanently on the first decision, including retries and win time', () => {
    const timers: CaseTimers = {}
    resumeCaseTimer(timers, 'a', 0)
    expect(freezeCaseTimer(timers, 'a', 4_000)).toBe(4)

    resumeCaseTimer(timers, 'a', 10_000)
    expect(freezeCaseTimer(timers, 'a', 30_000)).toBe(4)
    expect(getCaseElapsedSeconds(timers, 'a', 100_000)).toBe(4)
  })

  it('does not count time while another desktop app is active', () => {
    const timers: CaseTimers = {}
    resumeCaseTimer(timers, 'a', 0)
    pauseCaseTimer(timers, 'a', 1_500)
    resumeCaseTimer(timers, 'a', 20_000)
    expect(freezeCaseTimer(timers, 'a', 21_000)).toBe(2.5)
  })
})
