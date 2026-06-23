import { useEffect, useState } from 'react'
import {
  getBgMusic,
  DEFAULT_BG_MUSIC_VOLUME,
  subscribeBgMusicDuck,
} from '@/lib/bgMusic'
import styles from './BgMusicPlayer.module.css'

interface BgMusicPlayerProps {
  /** Track id from the BG_MUSIC registry. Ignored when `srcCustom` is set. */
  src?: string
  /** Per-node uploaded audio data URL — wins over `src`. */
  srcCustom?: string
  /** Editor-set default volume in 0..1. The on-screen slider lets the
   *  player tweak it; that runtime tweak isn't persisted. */
  defaultVolume?: number
  /** When false, the volume widget is hidden but the audio keeps
   *  playing. Toggled by the desktop's Start button. Defaults to true
   *  so existing call sites keep showing the widget. */
  showControl?: boolean
}

/**
 * BgMusicPlayer — owns a single looped audio element and a small
 * volume widget anchored to the bottom-left of the viewport.
 *
 * The `<audio>` is held in a module-level singleton so that mounting /
 * unmounting the component (which happens on the login → desktop
 * transition inside GamePage) doesn't restart the track. The component
 * pauses the audio on unmount.
 *
 * Browsers block autoplay before any user interaction, so the first
 * `play()` may reject. We retry once on the first user input — after
 * that the audio starts and keeps looping for the session.
 */
export function BgMusicPlayer({ src, srcCustom, defaultVolume, showControl = true }: BgMusicPlayerProps) {
  const initialVolume = clamp01(defaultVolume ?? DEFAULT_BG_MUSIC_VOLUME)
  const [volume, setVolume] = useState<number>(() => getStoredVolume(initialVolume))
  const [muted, setMuted] = useState<boolean>(() => getStoredMuted())
  /** External multiplier (1 = normal, 0.8 while a video with sound is
   *  playing). Toggled by FootageWindow via `pushBgMusicDuck`. */
  const [duckFactor, setDuckFactor] = useState(1)

  const url = srcCustom ?? getBgMusic(src).src

  useEffect(() => subscribeBgMusicDuck(setDuckFactor), [])

  useEffect(() => {
    const audio = ensureAudio(url)
    audio.volume = muted ? 0 : volume * duckFactor
    tryPlay(audio)
    return () => {
      // Pause when the widget leaves the screen (e.g. transition into
      // a win-result render). The audio object stays in memory at the
      // same currentTime; remounting resumes from there.
      audio.pause()
    }
    // We intentionally only watch the URL here — volume/mute/duck
    // changes are pushed via the next effect so slider drags don't
    // restart playback or pause/resume audibly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    const audio = getAudio()
    if (!audio) return
    audio.volume = muted ? 0 : volume * duckFactor
    storeVolume(volume)
    storeMuted(muted)
  }, [volume, muted, duckFactor])

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const pct = Number(e.target.value)
    if (!Number.isFinite(pct)) return
    setVolume(clamp01(pct / 100))
    if (muted) setMuted(false)
  }

  function toggleMute() {
    setMuted((m) => !m)
  }

  const effectivePct = Math.round((muted ? 0 : volume) * 100)
  const icon = muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'

  if (!showControl) return null

  return (
    <div className={styles.widget}>
      <button
        type="button"
        className={styles.muteBtn}
        onClick={toggleMute}
        title={muted ? 'Unmute background music' : 'Mute background music'}
        aria-label={muted ? 'Unmute background music' : 'Mute background music'}
      >
        {icon}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={effectivePct}
        onChange={handleSliderChange}
        className={styles.slider}
        aria-label="Background music volume"
      />
      <span className={styles.pct}>{effectivePct}%</span>
    </div>
  )
}

// ─── Audio singleton ──────────────────────────────────────────────
// One module-level Audio per game session. Survives component
// unmount/remount inside GamePage's conditional returns so the track
// keeps its currentTime across login → desktop and win → desktop
// transitions.

let audioInstance: HTMLAudioElement | null = null
let audioUrl: string | null = null
let autoplayRetryWired = false

function ensureAudio(url: string): HTMLAudioElement {
  if (audioInstance && audioUrl === url) return audioInstance
  // URL changed (or first call) — tear the old one down and build fresh.
  if (audioInstance) {
    audioInstance.pause()
    audioInstance.src = ''
    audioInstance = null
  }
  const audio = new Audio(url)
  audio.loop = true
  audioInstance = audio
  audioUrl = url
  return audio
}

function getAudio(): HTMLAudioElement | null {
  return audioInstance
}

function tryPlay(audio: HTMLAudioElement) {
  audio.play().catch(() => {
    if (autoplayRetryWired) return
    autoplayRetryWired = true
    const retry = () => {
      const a = getAudio()
      if (a) a.play().catch(() => { /* still blocked — give up silently */ })
      window.removeEventListener('pointerdown', retry)
      window.removeEventListener('keydown', retry)
      autoplayRetryWired = false
    }
    window.addEventListener('pointerdown', retry, { once: true })
    window.addEventListener('keydown', retry, { once: true })
  })
}

// ─── Per-session prefs ────────────────────────────────────────────
// Volume + mute live in sessionStorage so the player's tweak survives
// remounts (login → desktop) without leaking across browser sessions.

const VOLUME_KEY = 'bg-music-volume-v1'
const MUTED_KEY = 'bg-music-muted-v1'

function getStoredVolume(fallback: number): number {
  try {
    const raw = sessionStorage.getItem(VOLUME_KEY)
    if (raw == null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? clamp01(n) : fallback
  } catch {
    return fallback
  }
}

function storeVolume(v: number) {
  try { sessionStorage.setItem(VOLUME_KEY, String(v)) } catch { /* ignore */ }
}

function getStoredMuted(): boolean {
  try {
    return sessionStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function storeMuted(m: boolean) {
  try { sessionStorage.setItem(MUTED_KEY, m ? '1' : '0') } catch { /* ignore */ }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
