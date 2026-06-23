import type { WinVariant } from './winScreenImage'

/**
 * Registry of available win-screen images. The editor's Result node
 * lets the author pick one of these for each win result; the chosen
 * id is stored on the node as `data.winImage` and rendered by the
 * GamePage win stop.
 *
 * Variant ids align with `WinVariant` in `lib/winScreenImage.ts` so
 * the per-variant localStorage upload-override system keeps working.
 *
 * Add a new entry here when you drop a new image into
 * `assets/images/win-screens/` (and add the variant id to
 * `WinVariant` / `WIN_VARIANTS` in `lib/winScreenImage.ts`). Keep
 * the first entry as the default fallback — `getWinScreen(undefined)`
 * returns it.
 */
export interface WinScreenOption {
  id: WinVariant
  label: string
  src: string
}

export const WIN_SCREENS: WinScreenOption[] = [
  {
    id: 'graffiti',
    label: 'Graffiti',
    src: '/images/win-screens/Win03.svg',
  },
  {
    id: 'punching-dummy',
    label: 'Punching Dummy',
    src: '/images/win-screens/PunchingDummy/PunchingDummy_bg.png',
  },
  {
    id: 'punching-dummy-click',
    label: 'Punching Dummy (Click)',
    src: '/images/win-screens/PunchingDummy/PunchingDummy_bg.png',
  },
  {
    id: 'kippah-cutting',
    label: 'Kippah Cutting',
    src: '/images/win-screens/WinScreen_KippahCutting.svg',
  },
  {
    id: 'kippah-cutting-workshop',
    label: 'Kippah Cutting Workshop',
    src: '/images/win-screens/WinScreen_KippahCutting.png',
  },
]

export const DEFAULT_WIN_SCREEN_ID: WinVariant = WIN_SCREENS[0].id

/** Resolve a win-screen id (or `undefined`) to its option. Falls back
 *  to the first entry when the id is missing or unknown. */
export function getWinScreen(id: string | undefined): WinScreenOption {
  if (!id) return WIN_SCREENS[0]
  return WIN_SCREENS.find((s) => s.id === id) ?? WIN_SCREENS[0]
}
