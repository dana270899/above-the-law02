import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { startDragCursor, stopDragCursor } from '@/lib/dragCursor'
import { assetUrl } from '@/lib/paths'
import styles from './AchievementsWindow.module.css'

/* The standard entry flicker plays only on the first mount per page load.
   Tutorial-driven loops and forced component previews bypass this guard. */
let hasFlickeredInThisSession = false

/* ============================================================
   AchievementsWindow — Figma 617:10703 ("Achievements").

   Shield-and-star badge with a stack of six chevrons. A gold
   layer is clipped according to score progress so the artwork
   fills continuously from bottom to top.
   ============================================================ */

const A = assetUrl('/images/achievements')
const RANK_COUNT = 6
const ENTRY_FLICKER_INTERVAL_MS = 300
const ENTRY_FLICKER_TICKS = 6

type EntryFlickerPhase = 'empty' | 'full' | null

export type CaseOutcome = 'win' | 'lose' | null
export type PointPopupKind = 'win' | 'lose' | 'time'

export type AchievementsWindowProps = {
  /** Per-rank-slot outcomes. The first 6 entries drive the chevron states. */
  results?: CaseOutcome[]
  /** Current run score displayed below the rank badges. */
  total?: number
  /** Score at which the complete badge becomes gold. */
  winningTarget?: number
  /** Temporary points callout shown to the left of the bar. */
  pointPopup?: { id: string; points: number; kind?: PointPopupKind } | null
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
  total = 0,
  winningTarget = 1000,
  pointPopup = null,
  onClose,
  draggable = false,
  forceEntryFlicker = false,
  loopEntryFlicker = false,
  className,
}: AchievementsWindowProps) {
  const [displayedTotal, setDisplayedTotal] = useState(total)
  const previousTotalRef = useRef(total)

  const [playEntryFlicker] = useState(
    () => forceEntryFlicker || !hasFlickeredInThisSession,
  )
  const startsFlickering = playEntryFlicker || loopEntryFlicker
  const [entryFlickerPhase, setEntryFlickerPhase] =
    useState<EntryFlickerPhase>(startsFlickering ? 'empty' : null)
  const [suppressFillTransition, setSuppressFillTransition] =
    useState(startsFlickering)
  const wasLoopingRef = useRef(loopEntryFlicker)

  useEffect(() => {
    if (playEntryFlicker && !forceEntryFlicker) {
      hasFlickeredInThisSession = true
    }
  }, [forceEntryFlicker, playEntryFlicker])

  useEffect(() => {
    let intervalId: number | null = null
    let firstSettleFrame = 0
    let secondSettleFrame = 0

    const settleAtActualProgress = () => {
      setEntryFlickerPhase(null)

      // Keep clip-path transitions off while the actual score fill is
      // restored. Re-enable them after the snapped value has painted so
      // future score changes retain their normal smooth transition.
      firstSettleFrame = window.requestAnimationFrame(() => {
        secondSettleFrame = window.requestAnimationFrame(() => {
          setSuppressFillTransition(false)
        })
      })
    }

    if (loopEntryFlicker) {
      wasLoopingRef.current = true
      setSuppressFillTransition(true)
      setEntryFlickerPhase((phase) => phase ?? 'empty')
      intervalId = window.setInterval(() => {
        setEntryFlickerPhase((phase) => phase === 'full' ? 'empty' : 'full')
      }, ENTRY_FLICKER_INTERVAL_MS)
    } else if (wasLoopingRef.current) {
      wasLoopingRef.current = false
      settleAtActualProgress()
    } else if (playEntryFlicker) {
      setSuppressFillTransition(true)
      let tick = 0
      intervalId = window.setInterval(() => {
        tick += 1
        if (tick >= ENTRY_FLICKER_TICKS) {
          if (intervalId !== null) window.clearInterval(intervalId)
          intervalId = null
          settleAtActualProgress()
          return
        }
        setEntryFlickerPhase(tick % 2 === 0 ? 'empty' : 'full')
      }, ENTRY_FLICKER_INTERVAL_MS)
    }

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId)
      if (firstSettleFrame) window.cancelAnimationFrame(firstSettleFrame)
      if (secondSettleFrame) window.cancelAnimationFrame(secondSettleFrame)
    }
  }, [loopEntryFlicker, playEntryFlicker])

  useEffect(() => {
    const from = previousTotalRef.current
    const to = total
    previousTotalRef.current = to
    if (from === to) {
      setDisplayedTotal(to)
      return
    }
    const duration = 900
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayedTotal(Math.round(from + (to - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [total])

  const legacyProgress = results.filter((result) => result === 'win').length / RANK_COUNT
  const scoreProgress = winningTarget > 0 ? total / winningTarget : 0
  const progress = Math.min(1, Math.max(0, winningTarget > 0 ? scoreProgress : legacyProgress))
  const visibleProgress = entryFlickerPhase === 'empty'
    ? 0
    : entryFlickerPhase === 'full'
    ? 1
    : progress
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
    startDragCursor()
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
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      stopDragCursor()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragRef.current) {
        dragRef.current = null
        stopDragCursor()
      }
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

      {pointPopup && (
        <div
          key={pointPopup.id}
          className={`${styles.pointsPopup} ${styles[pointPopup.kind ?? (pointPopup.points < 0 ? 'lose' : 'win')]}`}
          aria-live="polite"
        >
          {pointPopup.points > 0 ? '+' : ''}{Math.round(pointPopup.points).toLocaleString('en-US')}
        </div>
      )}

      <div
        className={styles.badgeStack}
        role="progressbar"
        aria-label="Winning score progress"
        aria-valuemin={0}
        aria-valuemax={winningTarget}
        aria-valuenow={Math.min(Math.max(0, total), winningTarget)}
      >
        <BadgeArtwork filled={false} />
        <div
          className={`${styles.fillLayer} ${suppressFillTransition ? styles.fillLayerInstant : ''}`}
          style={{ clipPath: `inset(${(1 - visibleProgress) * 100}% 0 0)` }}
          data-entry-flicker={entryFlickerPhase ?? undefined}
          aria-hidden="true"
        >
          <BadgeArtwork filled />
        </div>
      </div>

      <div className={styles.scoreBlock} data-spot="rank.score">
        <p className={styles.scoreLabel}>Score</p>
        <p className={`${styles.scoreValue} ${displayedTotal < 0 ? styles.negativeScore : ''}`}>
          {Math.round(displayedTotal).toLocaleString('en-US')}
        </p>
      </div>
    </div>
  )
}

function BadgeArtwork({ filled }: { filled: boolean }) {
  return (
    <>
      <img
        data-spot="rank.shield"
        className={styles.shield}
        src={`${A}/${filled ? 'shield-win' : 'shield'}.svg`}
        alt=""
      />
      <div className={styles.chevrons} data-spot="rank.chevrons">
        {Array.from({ length: RANK_COUNT }, (_, index) => (
          <img
            key={index}
            className={styles.chevron}
            src={`${A}/${filled ? 'chevron-fill' : 'chevron-new'}.svg`}
            alt=""
          />
        ))}
      </div>
    </>
  )
}
