/**
 * SPOTLIGHT TARGETS
 *
 * Registry of every UI element or grouped area a tutorial message can
 * highlight. The editor's MessageNode reads this list to populate its
 * "Highlight" dropdown. Most targets match a `data-spot="<id>"`
 * attribute; grouped Case window targets are applied by CaseWindow
 * itself so scrolling keeps the same elements in color.
 *
 * Adding a new target is two steps:
 *   1. Append an entry to SPOTLIGHT_TARGETS below.
 *   2. Add `data-spot="<id>"` on the element you want highlightable.
 *
 * Ids are stable strings — never rename, only deprecate. Saved tutorial
 * messages reference these ids directly.
 */

export type SpotlightTarget = {
  /** Stable id — matched against `data-spot` on the rendered element. */
  id: string
  /** Human-readable label shown in the editor dropdown. */
  label: string
  /** Group header in the dropdown — purely cosmetic. */
  group: SpotlightGroup
}

export type SpotlightGroup =
  | 'Desktop'
  | 'Case window'
  | 'Rank window'
  | 'Boss message'

export const SPOTLIGHT_TARGETS: readonly SpotlightTarget[] = [
  // Desktop icons + taskbar
  { id: 'icon.rulebook',           label: 'Rulebook icon',          group: 'Desktop' },
  { id: 'icon.cases',              label: 'Cases icon',             group: 'Desktop' },
  { id: 'icon.operation',          label: 'Operation icon',         group: 'Desktop' },
  { id: 'icon.trash',              label: 'Trash icon',             group: 'Desktop' },
  { id: 'icon.whack',              label: 'Whack-a-Mole icon',      group: 'Desktop' },
  { id: 'taskbar.start',           label: 'Start button (taskbar)', group: 'Desktop' },

  // Case window sections
  { id: 'case.identity',           label: 'Case photo + text header + ID text', group: 'Case window' },
  { id: 'case.records',            label: 'Suspicions section + criminal record section', group: 'Case window' },
  { id: 'case.suspicion.attachment', label: 'Suspicion attachment file', group: 'Case window' },

  // Rank / Achievements window
  { id: 'rank.window',             label: 'Rank window (whole)',    group: 'Rank window' },
  { id: 'rank.shield',             label: 'Rank shield badge',      group: 'Rank window' },
  { id: 'rank.chevrons',           label: 'Rank chevrons',          group: 'Rank window' },

  // Boss message itself
  { id: 'boss.button',             label: 'Boss message button',    group: 'Boss message' },
] as const

/** Convenience: list of unique groups in registry order. Used by the
 *  editor dropdown to render `<optgroup>` sections. */
export const SPOTLIGHT_GROUPS: readonly SpotlightGroup[] = Array.from(
  new Set(SPOTLIGHT_TARGETS.map((t) => t.group)),
) as SpotlightGroup[]
