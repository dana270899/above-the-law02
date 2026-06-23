/**
 * Registry of sounds the editor can pick from for the Operation
 * Window V2's per-item click sounds. The editor's OperationNode
 * shows a dropdown per item (5 items) listing these options;
 * the chosen `src` is stored on the node in
 * `data.window.itemSounds[<itemKey>]`.
 *
 * Add a new entry here when you drop a new audio file into
 * `assets/sounds/`. The `src` is the public URL the browser
 * fetches at runtime (Vite serves `assets/` at `/`). Listed in
 * "first the gameplay-shaped ones, then the misc/legacy ones"
 * order so the picker's most-relevant options sit at the top.
 */
export interface OperationSoundOption {
  id: string
  label: string
  src: string
}

export const OPERATION_SOUNDS: OperationSoundOption[] = [
  // Per-item character sounds — match the V2 item keys.
  { id: 'minister-sound', label: 'Minister',          src: '/sounds/Minister sound.mp3' },
  { id: 'forces-sound',   label: 'Forces',            src: '/sounds/Forces.mp3' },
  { id: 'dog-sound',      label: 'Dog',               src: '/sounds/Dog.mp3' },
  { id: 'press-sound',    label: 'Press',             src: '/sounds/Press.mp3' },
  { id: 'rope-sound',     label: 'Rope',              src: '/sounds/Rope.mp3' },

  // Generic toggle / click sounds.
  { id: 'light-switch-01', label: 'Light Switch 01',  src: '/sounds/Light Switch 01.wav' },
  { id: 'light-switch-02', label: 'Light Switch 02',  src: '/sounds/Light Switch 02.wav' },
  { id: 'light-switch-03', label: 'Light Switch 03',  src: '/sounds/Light Switch 03.wav' },

  // Misc / shared with other features.
  { id: 'notification',         label: 'Notification chime',  src: '/sounds/notification.mp3' },
  { id: 'angry-01-mp3',         label: 'Angry 01',            src: '/sounds/angry01.mp3' },
  { id: 'angry-02-mp3',         label: 'Angry 02 (mp3)',      src: '/sounds/angry02.mp3' },
  { id: 'angry-02-wav',         label: 'Angry 02 (wav)',      src: '/sounds/angry02.wav' },
  { id: 'hashem-itbarach-mp3',  label: 'Hashem Itbarach (mp3)', src: '/sounds/Hashem Itbarach.mp3' },
  { id: 'hashem-itbarach-wav',  label: 'Hashem Itbarach (wav)', src: '/sounds/Hashem Itbarach.wav' },
  { id: 'falafel-pixel',        label: 'Falafel Pixel Pursuit', src: '/sounds/Falafel Pixel Pursuit.wav' },
]

/** Sentinel meaning "play no sound when this item is clicked". */
export const OPERATION_SOUND_NONE = '__none__'

/**
 * Resolve a stored sound `src` to its registered option. Returns
 * `null` when the value is the no-sound sentinel; returns
 * `undefined` when the src isn't registered (caller decides
 * whether to fall back to a default).
 */
export function findOperationSound(
  src: string | null | undefined,
): OperationSoundOption | null | undefined {
  if (src === OPERATION_SOUND_NONE) return null
  if (!src) return undefined
  return OPERATION_SOUNDS.find((s) => s.src === src)
}
