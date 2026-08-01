import { describe, expect, it } from 'vitest'
import type { CaseNodeData } from '@/types/editor'
import {
  buildRunScore,
  calculateCaseScore,
  combineRetryScore,
  DEFAULT_SCORING_SETTINGS,
  recordCaseScore,
} from './scoring'

function caseData(patch: Partial<CaseNodeData> = {}): CaseNodeData {
  return {
    nodeType: 'case',
    caseId: 'case-1',
    title: 'Case 1',
    order: 1,
    hasOperation: false,
    ...patch,
  }
}

describe('calculateCaseScore', () => {
  it.each([
    [false, 1, 100],
    [false, 2, 50],
    [true, 1, 200],
    [true, 2, 100],
  ] as const)('awards important=%s attempt=%s correctly', (important, attempt, expected) => {
    const result = calculateCaseScore({
      caseData: caseData({ isImportant: important }),
      correct: true,
      attempt,
      elapsedSeconds: 20,
      settings: DEFAULT_SCORING_SETTINGS,
    })
    expect(result.basePoints).toBe(expected)
  })

  it.each([0, 0.01, 50, 100, 150])('does not award extra points for finishing at %s seconds', (elapsedSeconds) => {
    const result = calculateCaseScore({
      caseData: caseData(),
      correct: true,
      attempt: 1,
      elapsedSeconds,
      settings: { ...DEFAULT_SCORING_SETTINGS, speedTimeLimitSeconds: 100, speedMaxBonus: 50 },
    })
    expect(result.speedPoints).toBe(0)
    expect(result.totalPoints).toBe(result.basePoints)
  })

  it('deducts the configured base points for an incorrect result', () => {
    const result = calculateCaseScore({
      caseData: caseData({ isImportant: true }),
      correct: false,
      attempt: 2,
      elapsedSeconds: 0,
      settings: { ...DEFAULT_SCORING_SETTINGS, speedTimeLimitSeconds: 100, speedMaxBonus: 100 },
    })
    expect(result.totalPoints).toBe(-100)
  })

  it('records a case only once across repeated actions and revisits', () => {
    const first = calculateCaseScore({ caseData: caseData(), correct: true, attempt: 1, elapsedSeconds: 1, settings: { ...DEFAULT_SCORING_SETTINGS, speedBonusEnabled: false } })
    const repeated = { ...first, totalPoints: 999 }
    const state = recordCaseScore({}, first)
    expect(recordCaseScore(state, repeated)).toBe(state)
    expect(state['case-1'].totalPoints).toBe(100)
  })

  it('keeps the first loss and adds only the second-chance award', () => {
    const settings = { ...DEFAULT_SCORING_SETTINGS, speedBonusEnabled: false }
    const loss = calculateCaseScore({ caseData: caseData(), correct: false, attempt: 1, elapsedSeconds: 1, settings })
    const retry = calculateCaseScore({ caseData: caseData(), correct: true, attempt: 2, elapsedSeconds: 1, settings })
    const combined = combineRetryScore(loss, retry)
    expect(loss.totalPoints).toBe(-100)
    expect(retry.totalPoints).toBe(50)
    expect(combined.totalPoints).toBe(-50)
  })

  it('marks a run as won without preventing later cases from raising the score', () => {
    const settings = { ...DEFAULT_SCORING_SETTINGS, speedBonusEnabled: false }
    const one = calculateCaseScore({ caseData: caseData(), correct: true, attempt: 1, elapsedSeconds: 1, settings })
    const two = calculateCaseScore({ caseData: caseData({ caseId: 'case-2', title: 'Case 2', isImportant: true }), correct: true, attempt: 1, elapsedSeconds: 1, settings })
    expect(buildRunScore([one], 100)).toMatchObject({ total: 100, won: true })
    expect(buildRunScore([one, two], 100)).toMatchObject({ total: 300, won: true })
  })

  it('adds one normalized mini-game contribution to the run total', () => {
    const one = calculateCaseScore({ caseData: caseData(), correct: true, attempt: 1, elapsedSeconds: 1, settings: DEFAULT_SCORING_SETTINGS })
    expect(buildRunScore([one], 150, 49.6)).toMatchObject({ total: 150, miniGamePoints: 50, won: true })
    expect(buildRunScore([one], 150, -20)).toMatchObject({ total: 100, miniGamePoints: 0, won: false })
  })

  it('adds signed, normalized flow points to the run total', () => {
    expect(buildRunScore([], 100, 0, 125.6)).toMatchObject({ total: 126, flowPoints: 126, won: true })
    expect(buildRunScore([], 100, 0, -40.4)).toMatchObject({ total: -40, flowPoints: -40, won: false })
  })
})
