import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import styles from './AchievementsWindow.module.css'

/* Module-level flag: the whole-bar entry flicker plays only on the
   FIRST mount of this window per page load. Subsequent opens render
   without the entry animation. Module scope (not state) so the flag
   survives unmount/remount during the same session. */
let hasFlickeredInThisSession = false

/* ============================================================
   AchievementsWindow — Figma 538:21055 ("Ranks").

   Shield-and-star badge with a stack of six chevron rank
   markers. Each chevron reflects a case outcome (Figma
   578:25449): yellow = win, red = lose, white = not played.
   When all six slots are wins, the shield turns gold to match
   the "Win" badge variant (Figma 588:16620).
   ============================================================ */

const A = '/images/achievements'
const RANK_COUNT = 6

export type CaseOutcome = 'win' | 'lose' | null

export type AchievementsWindowProps = {
  /** Per-rank-slot outcomes. The first 6 entries drive the chevron states. */
  results?: CaseOutcome[]
  /** Kept for backward compatibility with callers — the design has a fixed 6 ranks. */
  total?: number
  /** When set, the window renders a close button in the top-right. */
  onClose?: () => void
  /** When true, the window is absolute-positioned and draggable by the header. */
  draggable?: boolean
  /** Demo/preview escape hatch: always play the whole-bar entry flicker on
   *  mount, bypassing the once-per-session guard. Used by the Components
   *  page to make the animation replayable on demand. */
  forceEntryFlicker?: boolean
  /** When true, the entry flicker keeps cycling empty↔full instead of
   *  settling after 6 ticks. Settles within ~150ms once the prop flips
   *  back to false. Used by GamePage so the bar keeps flickering until
   *  the player advances past the message that opened the window. */
  loopEntryFlicker?: boolean
  className?: string
}

export function AchievementsWindow({
  results = [],
  onClose,
  draggable = false,
  forceEntryFlicker = false,
  loopEntryFlicker = false,
  className,
}: AchievementsWindowProps) {
  const slots: CaseOutcome[] = Array.from(
    { length: RANK_COUNT },
    (_, i) => results[i] ?? null,
  )
  const allWin = slots.every((r) => r === 'win')

  /* First-appearance flicker: render with the entry-flicker state machine
     only on the first mount of this window per page load. The decision is
     captured in `useState`'s lazy initializer (pure — safe under React
     StrictMode's double-invoke), and the module flag is mutated in a
     useEffect side-effect so subsequent mounts read the new value.
     `forceEntryFlicker` overrides the guard for demo/preview use. */
  const [playEntryFlicker] = useState(
    () => forceEntryFlicker || !hasFlickeredInThisSession,
  )
  useEffect(() => {
    if (playEntryFlicker && !forceEntryFlicker) hasFlickeredInThisSession = true
  }, [playEntryFlicker, forceEntryFlicker])

  /* Phase machine — drives the empty↔full visual swap that plays as the
     bar appears. `null` means "settled, render the actual results". The
     bar starts on `empty` (so the first paint matches the empty state),
     then alternates every 150ms. By default it settles after 6 ticks
     (~900ms). When `loopEntryFlicker` is true, it keeps cycling
     indefinitely and only settles once the prop flips back to false. */
  const [entryFlickerPhase, setEntryFlickerPhase] = useState<
    'empty' | 'full' | null
  >(playEntryFlicker ? 'empty' : null)

  // Mirror the loop prop into a ref so the interval body reads the
  // current value without restarting on every change.
  const loopRef = useRef(loopEntryFlicker)
  useEffect(() => {
    loopRef.current = loopEntryFlicker
  }, [loopEntryFlicker])

  useEffect(() => {
    if (!playEntryFlicker) return
    let step = 0
    const id = window.setInterval(() => {
      step++
      if (!loopRef.current && step >= 6) {
        window.clearInterval(id)
        setEntryFlickerPhase(null)
        return
      }
      setEntryFlickerPhase(step % 2 === 0 ? 'empty' : 'full')
    }, 150)
    return () => window.clearInterval(id)
  }, [playEntryFlicker])

  const showFlickerFull = entryFlickerPhase === 'full'
  const showFlickerEmpty = entryFlickerPhase === 'empty'
  const shieldSrc = showFlickerFull
    ? `${A}/shield-win.svg`
    : showFlickerEmpty
    ? `${A}/shield.svg`
    : allWin
    ? `${A}/shield-win.svg`
    : `${A}/shield.svg`
  /* --- Drag (only when draggable) -------------------- */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  const windowRef = useRef<HTMLDivElement | null>(null)

  function onHeaderMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (!draggable) return
    if ((e.target as HTMLElement).closest('button')) return
    const el = windowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    }
    e.preventDefault()
  }

  useEffect(() => {
    if (!draggable) return
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const el = windowRef.current
      const w = el?.offsetWidth ?? 0
      const maxX = window.innerWidth - Math.min(w, 200)
      const maxY = window.innerHeight - 50
      const x = Math.max(-w + 200, Math.min(maxX, d.originX + dx))
      const y = Math.max(0, Math.min(maxY, d.originY + dy))
      setPos({ x, y })
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggable])

  const positionStyle: CSSProperties = !draggable
    ? {}
    : pos == null
    ? { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
    : { position: 'absolute', left: pos.x, top: pos.y, transform: 'none' }

  return (
    <div
      ref={windowRef}
      data-spot="rank.window"
      className={[
        styles.window,
        draggable ? styles.draggable : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={positionStyle}
      onMouseDown={onHeaderMouseDown}
    >
      {onClose && (
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      )}

      <div className={styles.badgeStack}>
        <img data-spot="rank.shield" className={styles.shield} src={shieldSrc} alt="" />
        <div className={styles.chevrons} data-spot="rank.chevrons">
          {/* Fills bottom-to-top: slot 0 is the lowest chevron, advances upward.
              During the entry-flicker phase we render plain <img> tags forced
              to either the all-empty or all-full state so the bar reads as a
              clean swap between two design states. After it settles we mount
              ChevronSlot, which then handles per-rank flickers on real
              outcome transitions. */}
          {entryFlickerPhase !== null
            ? slots.map((_, i) => (
                <img
                  key={i}
                  className={styles.chevron}
                  style={{ order: RANK_COUNT - 1 - i }}
                  src={showFlickerFull ? `${A}/chevron-win.svg` : `${A}/chevron.svg`}
                  alt=""
                />
              ))
            : slots.map((outcome, i) => (
                <ChevronSlot
                  key={i}
                  outcome={outcome}
                  order={RANK_COUNT - 1 - i}
                />
              ))}
        </div>
      </div>

      <p className={styles.title}>Ranks</p>
    </div>
  )
}

/* One chevron slot. Owns its own "just transitioned to win" state so
   only the chevron that *changed* flickers — not every yellow chevron
   on every parent re-render. The initial-mount guard means already-won
   chevrons present on first open render silently (the whole-bar entry
   flicker covers that moment). */
function ChevronSlot({
  outcome,
  order,
}: {
  outcome: CaseOutcome
  order: number
}) {
  const [isFlickering, setIsFlickering] = useState(false)
  const prevOutcomeRef = useRef<CaseOutcome | 'init'>('init')

  useEffect(() => {
    const prev = prevOutcomeRef.current
    prevOutcomeRef.current = outcome

    // Skip the initial mount — either the bar is entering for the
    // first time (whole-bar flicker covers it) or we're re-opening
    // with existing wins that shouldn't replay.
    if (prev === 'init') return

    // Only flicker on a real transition INTO 'win'. Lose / null are
    // applied silently.
    if (prev !== 'win' && outcome === 'win') {
      setIsFlickering(true)
      const id = window.setTimeout(() => setIsFlickering(false), 600)
      return () => window.clearTimeout(id)
    }
  }, [outcome])

  return (
    <img
      className={`${styles.chevron}${isFlickering ? ` ${styles.chevronFlicker}` : ''}`}
      style={{ order }}
      src={chevronSrc(outcome)}
      alt=""
    />
  )
}

function chevronSrc(outcome: CaseOutcome): string {
  if (outcome === 'win') return `${A}/chevron-win.svg`
  if (outcome === 'lose') return `${A}/chevron-lose.svg`
  return `${A}/chevron.svg`
}
