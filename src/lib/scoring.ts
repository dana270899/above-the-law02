import type { CaseNodeData } from '@/types/editor'

export interface ScoringSettings {
  winningTarget: number
  normalFirstPoints: number
  normalSecondPoints: number
  importantFirstPoints: number
  importantSecondPoints: number
  speedBonusEnabled: boolean
  speedTimeLimitSeconds: number
  speedMaxBonus: number
}

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  winningTarget: 600,
  normalFirstPoints: 100,
  normalSecondPoints: 50,
  importantFirstPoints: 200,
  importantSecondPoints: 100,
  speedBonusEnabled: true,
  speedTimeLimitSeconds: 120,
  speedMaxBonus: 50,
}

export interface PlayerProfile {
  name: string
  photo?: Blob | null
  photoPreviewUrl?: string | null
}

export type PublicationConsent = 'pending' | 'approved' | 'declined'

export interface CaseScoreBreakdown {
  caseId: string
  title: string
  important: boolean
  attempt: 1 | 2
  correct: boolean
  basePoints: number
  speedPoints: number
  elapsedSeconds: number
  totalPoints: number
}

export interface RunScore {
  total: number
  target: number
  won: boolean
  cases: CaseScoreBreakdown[]
}

export function recordCaseScore(
  current: Readonly<Record<string, CaseScoreBreakdown>>,
  breakdown: CaseScoreBreakdown,
): Record<string, CaseScoreBreakdown> {
  if (current[breakdown.caseId]) return current as Record<string, CaseScoreBreakdown>
  return { ...current, [breakdown.caseId]: breakdown }
}

export function buildRunScore(
  cases: CaseScoreBreakdown[],
  winningTarget: number,
): RunScore {
  const immutableCases = cases.map((item) => Object.freeze({ ...item }))
  const total = immutableCases.reduce((sum, item) => sum + item.totalPoints, 0)
  return Object.freeze({
    total,
    target: winningTarget,
    won: total >= winningTarget,
    cases: Object.freeze(immutableCases) as unknown as CaseScoreBreakdown[],
  })
}

export function calculateCaseScore(args: {
  caseData: CaseNodeData
  correct: boolean
  attempt: 1 | 2
  elapsedSeconds: number
  settings: ScoringSettings
}): CaseScoreBreakdown {
  const { caseData, correct, attempt, settings } = args
  const elapsedSeconds = Math.max(0, args.elapsedSeconds)
  const important = !!caseData.isImportant
  const basePoints = !correct
    ? 0
    : important
      ? attempt === 1 ? settings.importantFirstPoints : settings.importantSecondPoints
      : attempt === 1 ? settings.normalFirstPoints : settings.normalSecondPoints
  const speedPoints = !correct || !settings.speedBonusEnabled || settings.speedTimeLimitSeconds <= 0
    ? 0
    : Math.round(settings.speedMaxBonus * Math.max(0, 1 - elapsedSeconds / settings.speedTimeLimitSeconds))

  return Object.freeze({
    caseId: caseData.caseId,
    title: caseData.title,
    important,
    attempt,
    correct,
    basePoints,
    speedPoints,
    elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
    totalPoints: basePoints + speedPoints,
  })
}
