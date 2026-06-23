/**
 * WIN-SCREEN IMAGE OVERRIDE
 *
 * Each win-screen component (Graffiti, Punching Dummy, …) ships with a
 * bundled SVG under `/images/win-screens/`. The editor lets the user
 * upload a custom image PER VARIANT to replace the bundled default.
 * The override is stored as a data URL in localStorage so every
 * instance of that variant — the live game, the standalone preview
 * route, and the editor's preview iframe — picks it up automatically.
 *
 * Cross-document updates: writing localStorage fires a `storage` event
 * in every OTHER same-origin document (including iframes). Same-tab
 * listeners get a custom `WIN_IMAGE_EVENT` instead; the event detail
 * carries the variant so listeners can ignore unrelated changes.
 */

export type WinVariant =
  | 'graffiti'
  | 'punching-dummy'
  | 'punching-dummy-click'
  | 'kippah-cutting'
  | 'kippah-cutting-workshop'

/** Stable list of every supported variant — used by the editor. */
export const WIN_VARIANTS: readonly WinVariant[] = [
  'graffiti',
  'punching-dummy',
  'punching-dummy-click',
  'kippah-cutting',
  'kippah-cutting-workshop',
]

/** Same-tab change notification. detail.variant tells you which one. */
export const WIN_IMAGE_EVENT = 'winscreen-image-changed'

export interface WinImageEventDetail {
  variant: WinVariant
}

/** Per-variant localStorage key. Exposed so listeners can filter
 *  cross-document `storage` events by key. */
export function winScreenImageKey(variant: WinVariant): string {
  return `game-winscreen-${variant}-image-v1`
}

/** Return the override data URL for a variant, or null if none is set. */
export function loadWinScreenImage(variant: WinVariant): string | null {
  try {
    return localStorage.getItem(winScreenImageKey(variant))
  } catch {
    return null
  }
}

/**
 * Persist a new override for a variant. Throws on quota errors so
 * callers can show the user a friendly "image too large" message.
 */
export function saveWinScreenImage(
  variant: WinVariant,
  dataUrl: string,
): void {
  localStorage.setItem(winScreenImageKey(variant), dataUrl)
  window.dispatchEvent(
    new CustomEvent<WinImageEventDetail>(WIN_IMAGE_EVENT, {
      detail: { variant },
    }),
  )
}

/** Remove the override for a variant, restoring its bundled default. */
export function clearWinScreenImage(variant: WinVariant): void {
  try {
    localStorage.removeItem(winScreenImageKey(variant))
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<WinImageEventDetail>(WIN_IMAGE_EVENT, {
      detail: { variant },
    }),
  )
}
