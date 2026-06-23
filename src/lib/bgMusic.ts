import { assetUrl } from './paths'

/**
 * Registry of background-music tracks available to the bgMusic editor
 * node. The author either picks one of these or uploads a custom audio
 * file from the node card; the runtime loops the chosen track behind
 * every screen except the win-result screen.
 *
 * Add a new entry here when you drop a new audio file into
 * `assets/sounds/`. Keep the first entry as the default fallback —
 * `getBgMusic(undefined)` returns it.
 */
export interface BgMusicOption {
  id: string
  label: string
  src: string
}

export const BG_MUSIC: BgMusicOption[] = [
  {
    id: 'falafel',
    label: 'Falafel Pixel Pursuit',
    src: assetUrl('/sounds/Falafel Pixel Pursuit.wav'),
  },
]

export const DEFAULT_BG_MUSIC_ID = BG_MUSIC[0].id

/** Default editor volume when a fresh bgMusic node is created. */
export const DEFAULT_BG_MUSIC_VOLUME = 0.4

/** Resolve a bg-music id (or `undefined`) to its option. Falls back to
 *  the first entry when the id is missing or unknown. */
export function getBgMusic(id: string | undefined): BgMusicOption {
  if (!id) return BG_MUSIC[0]
  return BG_MUSIC.find((s) => s.id === id) ?? BG_MUSIC[0]
}

/* ─── Ducking ──────────────────────────────────────────────────────
 * Other components (e.g. FootageWindow when a sound-bearing video is
 * playing) can call `pushBgMusicDuck()` to ask the bg music to lower
 * to `DUCK_FACTOR` of its current volume, and `popBgMusicDuck()` to
 * release. The BgMusicPlayer subscribes to changes so the slider's
 * value remains the user-facing reference, with the duck applied as
 * a multiplier on top.
 *
 * The counter approach means overlapping sources (two attachments,
 * unlikely but possible) duck correctly and only restore when the
 * last one is gone.
 * ─────────────────────────────────────────────────────────────── */

/** Multiplier applied while at least one duck source is active. */
export const DUCK_FACTOR = 0.8

let duckCount = 0
type DuckListener = (factor: number) => void
const duckListeners = new Set<DuckListener>()

function currentDuckFactor(): number {
  return duckCount > 0 ? DUCK_FACTOR : 1
}

function notifyDuck() {
  const factor = currentDuckFactor()
  duckListeners.forEach((l) => l(factor))
}

export function pushBgMusicDuck(): void {
  duckCount++
  notifyDuck()
}

export function popBgMusicDuck(): void {
  if (duckCount > 0) duckCount--
  notifyDuck()
}

/** Subscribe to duck-factor changes. Calls the listener immediately
 *  with the current factor. Returns an unsubscribe function. */
export function subscribeBgMusicDuck(listener: DuckListener): () => void {
  duckListeners.add(listener)
  listener(currentDuckFactor())
  return () => { duckListeners.delete(listener) }
}
