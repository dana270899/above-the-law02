export type OrderedCase = { caseId: string }

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** Format a case-tab timestamp in the authored DD/MM/YYYY HH:mm AM/PM style. */
export function formatCaseTimestamp(date: Date): string {
  const day = twoDigits(date.getDate())
  const month = twoDigits(date.getMonth() + 1)
  const year = date.getFullYear()
  const hours = twoDigits(date.getHours())
  const minutes = twoDigits(date.getMinutes())
  const period = date.getHours() >= 12 ? 'PM' : 'AM'
  return `${day}/${month}/${year} ${hours}:${minutes} ${period}`
}

/**
 * The first case is always available. Every later case becomes available
 * only after the immediately preceding case is complete, except for a
 * direct editor preview of that specific case.
 */
export function isCaseUnlocked(
  cases: OrderedCase[],
  index: number,
  completedCaseIds: ReadonlySet<string>,
  previewCaseIds: ReadonlySet<string>,
): boolean {
  const current = cases[index]
  if (!current) return false
  if (index === 0) return true
  return completedCaseIds.has(cases[index - 1].caseId)
    || previewCaseIds.has(current.caseId)
}
