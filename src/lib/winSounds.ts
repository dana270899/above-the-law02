/**
 * Registry of available win-screen sounds. The editor's Result node
 * lets the author pick one of these (or upload a custom audio file)
 * for each win result; the chosen id is stored on the node as
 * `data.winSound`, and uploaded audio data URLs as
 * `data.winSoundCustom`.
 *
 * Add a new entry here when you drop a new audio file into
 * `assets/sounds/`. Keep the first entry as the default fallback —
 * `getWinSound(undefined)` returns it.
 */
export interface WinSoundOption {
  id: string
  label: string
  src: string
}

export const WIN_SOUNDS: WinSoundOption[] = [
  {
    id: 'notification',
    label: 'Notification chime',
    src: '/sounds/notification.mp3',
  },
  {
    id: 'hashem-itbarach',
    label: 'Hashem Itbarach',
    src: '/sounds/Hashem Itbarach.mp3',
  },
]

export const DEFAULT_WIN_SOUND_ID = WIN_SOUNDS[0].id

/** Sentinel id meaning "play no sound when this win screen appears". */
export const WIN_SOUND_NONE = '__none__'

/** Resolve a win-sound id (or `undefined`) to its option. Returns
 *  `null` when the id is the no-sound sentinel; falls back to the
 *  first entry when the id is missing or unknown. */
export function getWinSound(id: string | undefined): WinSoundOption | null {
  if (id === WIN_SOUND_NONE) return null
  if (!id) return WIN_SOUNDS[0]
  return WIN_SOUNDS.find((s) => s.id === id) ?? WIN_SOUNDS[0]
}
