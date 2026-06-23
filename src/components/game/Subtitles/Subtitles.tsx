import { useEffect, useState } from 'react'
import type { SubtitleCue } from '@/types/editor'
import styles from './Subtitles.module.css'

/* ═══════════════════════════════════════════════
   SUBTITLES OVERLAY
   Renders a single, large bottom-of-desktop subtitle
   line driven by a list of `SubtitleCue`s and the
   wall-clock time since the parent mounted this
   component (which is when the voice message
   appeared on screen).
════════════════════════════════════════════════ */

export interface SubtitlesProps {
  /** Ordered list of cues. Each shows from `at` until the next cue. */
  cues: SubtitleCue[]
  /** Optional total clip length — extends the LAST cue until this time.
   *  Without it, the last cue's display ends `at + 3` seconds. */
  voiceDuration?: number
}

export function Subtitles({ cues, voiceDuration }: SubtitlesProps) {
  const text = useCurrentSubtitle(cues, voiceDuration)
  if (!text) return null
  return (
    <div className={styles.layer} aria-live="polite">
      <p className={styles.text}>{text}</p>
    </div>
  )
}

/**
 * Returns the subtitle text that should be visible right now, or null.
 *
 * Re-evaluates only at cue boundaries — we schedule a single timeout to
 * the next boundary rather than ticking every frame, so the overlay
 * stays cheap.
 */
function useCurrentSubtitle(
  cues: SubtitleCue[],
  voiceDuration: number | undefined,
): string | null {
  const [now, setNow] = useState(() => 0)

  useEffect(() => {
    if (cues.length === 0) return
    const start = Date.now()

    // Pre-compute every transition point (each cue's `at`, plus the end
    // of the last cue). At each point we re-render to pick up the new
    // active cue (or to clear it once everything has played).
    const sorted = [...cues].sort((a, b) => a.at - b.at)
    const endAt = voiceDuration != null
      ? voiceDuration
      : sorted[sorted.length - 1].at + 3
    const transitions = [...sorted.map((c) => c.at), endAt]
      .filter((t) => t > 0)
      .sort((a, b) => a - b)

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    function tick() {
      if (cancelled) return
      const elapsed = (Date.now() - start) / 1000
      setNow(elapsed)
      const next = transitions.find((t) => t > elapsed)
      if (next == null) return                   // past the last transition
      timer = setTimeout(tick, Math.max(50, (next - elapsed) * 1000))
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [cues, voiceDuration])

  return pickCue(cues, now, voiceDuration)
}

/** Pure: which cue's text should be visible at elapsed time `t`? */
function pickCue(
  cues: SubtitleCue[],
  t: number,
  voiceDuration: number | undefined,
): string | null {
  if (cues.length === 0) return null
  const sorted = [...cues].sort((a, b) => a.at - b.at)
  const endAt = voiceDuration != null
    ? voiceDuration
    : sorted[sorted.length - 1].at + 3
  if (t >= endAt) return null

  // Last cue whose `at` is <= t.
  let active: SubtitleCue | null = null
  for (const c of sorted) {
    if (c.at <= t) active = c
    else break
  }
  if (!active) return null
  if (!active.text) return null   // empty text = explicit hide
  return active.text
}
