import { describe, expect, it } from 'vitest'
import { formatCaseTimestamp, isCaseUnlocked } from './caseProgression'

const cases = [
  { caseId: '861' },
  { caseId: '862' },
  { caseId: '863' },
]

describe('case progression', () => {
  it('starts with only the first case unlocked', () => {
    const completed = new Set<string>()
    const previews = new Set<string>()

    expect(cases.map((_, index) => isCaseUnlocked(cases, index, completed, previews)))
      .toEqual([true, false, false])
  })

  it('unlocks only the case immediately after a completed case', () => {
    const completed = new Set(['861'])
    const previews = new Set<string>()

    expect(cases.map((_, index) => isCaseUnlocked(cases, index, completed, previews)))
      .toEqual([true, true, false])
  })

  it('allows a direct editor preview without unlocking other cases', () => {
    const completed = new Set<string>()
    const previews = new Set(['863'])

    expect(cases.map((_, index) => isCaseUnlocked(cases, index, completed, previews)))
      .toEqual([true, false, true])
  })
})

describe('case timestamps', () => {
  it('formats the local game-start time for the final case tab', () => {
    const startedAt = new Date(2026, 6, 31, 20, 33)
    expect(formatCaseTimestamp(startedAt)).toBe('31/07/2026 20:33 PM')
  })
})
