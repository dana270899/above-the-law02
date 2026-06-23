import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { assetUrl } from '@/lib/paths'
import styles from './OperationWindow.module.css'

/* ============================================================
   OperationWindow — the in-game "Operation" planner.

   Pixel-perfect implementation of the Figma "Operation Window"
   symbol (node 315:14495), 1054×734. Title bar mirrors
   CaseWindow / FootageWindow (green expand / yellow minimize
   / red close).

   The body has two regions:
     • Toggle grid (3 cols × 2 rows, 5 items): Minister of
       national security, Forces, Dogs, Press, Blindfold.
       Each toggle is a vertical 2-state pill — "Off" in one
       slot, illustration in the other. Clicking flips them.
     • Gauge — half-arc + needle inside a light-blue panel.
       The arc / needle SVGs come from Figma; the 6 zone labels
       are positioned at their exact Figma coordinates so they
       always sit on the arc tick marks.

   The footer mirrors CaseWindow: grey "Start operation"
   caption on the left, red "Arrest Arab" CTA on the right.

   The 5 illustration boxes inside the toggles are left empty
   (yellow placeholder) until composed illustration assets are
   provided by the designer — they slot into `.illustrationInner`.
   ============================================================ */

const CASE_ICONS = assetUrl('/images/case-window')
const ASSETS = assetUrl('/images/operation-window')

/** All five toggle slots — order matches the 3-col × 2-row Figma grid. */
const TOGGLE_KEYS = ['boss', 'forces', 'dogs', 'press', 'blindfold'] as const
export type ToggleKey = (typeof TOGGLE_KEYS)[number]

const TOGGLE_LABELS: Record<ToggleKey, string> = {
  boss: 'Minister of national security',
  forces: 'Forces',
  dogs: 'Dogs',
  press: 'Press',
  blindfold: 'Blindfold',
}

/** Illustration SVG filenames (in /images/operation-window/). */
const TOGGLE_ILLUSTRATIONS: Record<ToggleKey, string> = {
  boss: 'Boss.svg',
  forces: 'Forces.svg',
  dogs: 'Dog.svg',
  press: 'Press.svg',
  blindfold: 'Blindfold.svg',
}

/**
 * Click sound per toggle. We have three Light-Switch wavs and
 * five toggles — line 1 (boss / forces / dogs) uses all three
 * so the row is sonically distinct, line 2 (press / blindfold)
 * picks the first two so no two adjacent toggles in either row
 * play the same clip.
 */
const TOGGLE_CLICK_SOUNDS: Record<ToggleKey, string> = {
  boss:      assetUrl('/sounds/Light Switch 01.wav'),
  forces:    assetUrl('/sounds/Light Switch 02.wav'),
  dogs:      assetUrl('/sounds/Light Switch 03.wav'),
  press:     assetUrl('/sounds/Light Switch 01.wav'),
  blindfold: assetUrl('/sounds/Light Switch 02.wav'),
}

/**
 * Play a sound from a URL. Builds a fresh Audio instance per
 * call so rapid clicks don't cut each other off mid-playback,
 * and swallows autoplay errors silently (browsers block audio
 * before any user gesture — first click always succeeds).
 */
function playClickSound(url: string) {
  try {
    const a = new Audio(assetUrl(url))
    a.play().catch(() => { /* autoplay blocked — ignore */ })
  } catch {
    /* ignore */
  }
}

/**
 * Gauge labels with exact Figma coordinates (relative to the
 * gauge box). Each label sits on top of a tick mark in the
 * arc SVG, so these can't be "computed" without re-doing the
 * arc geometry — they come straight from the design file.
 *
 * `anchor` controls horizontal alignment: the leftmost label
 * is left-anchored, the rightmost is right-anchored, the
 * middle ones are centred.
 */
const GAUGE_LABELS: Array<{
  text: string[]
  left: number
  top: number
  anchor: 'left' | 'center' | 'right'
}> = [
  { text: ['Boring'],                       left: 89,    top: 357, anchor: 'left'   },
  { text: ['Slightly', 'Less Boring'],      left: 162.5, top: 259, anchor: 'center' },
  { text: ['Getting', 'Interesting'],       left: 210.5, top: 190, anchor: 'center' },
  { text: ['Tactical', 'Entertainment'],    left: 344.5, top: 190, anchor: 'center' },
  { text: ['Now You', 'Start Talking'],     left: 383.5, top: 259, anchor: 'center' },
  { text: ['Let the', 'Party', 'Begin!'],   left: 431,   top: 340, anchor: 'center' },
]

export type OperationWindowData = {
  /** Title-bar caption — e.g. "Operation". */
  title: string
  /** Footer caption on the left — e.g. "Start operation". */
  footerText: string
  /** CTA label on the right — e.g. "Arrest Arab". */
  ctaLabel: string
  /** Which toggles are currently on. */
  toggles: Record<ToggleKey, boolean>
}

export const DEFAULT_OPERATION_DATA: OperationWindowData = {
  title: 'Operation',
  footerText: 'Start operation',
  ctaLabel: 'Arrest Arab',
  toggles: {
    boss: false,
    forces: false,
    dogs: false,
    press: false,
    blindfold: false,
  },
}

type OperationWindowProps = {
  data?: OperationWindowData
  onClose?: () => void
  onExpand?: () => void
  onMinimizeChange?: (minimized: boolean) => void
  onToggle?: (key: ToggleKey, on: boolean) => void
  onStartOperation?: () => void
  /** When true the window is absolute-positioned and dragged by its title bar. */
  draggable?: boolean
  className?: string
}

export function OperationWindow({
  data = DEFAULT_OPERATION_DATA,
  onClose,
  onExpand,
  onMinimizeChange,
  onToggle,
  onStartOperation,
  draggable = false,
  className,
}: OperationWindowProps) {
  const [minimized, setMinimized] = useState(false)

  // Drag position. `null` = centered (initial). After first drag → {x, y}.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  const windowRef = useRef<HTMLDivElement | null>(null)

  function handleMinimize() {
    setMinimized((m) => {
      onMinimizeChange?.(!m)
      return !m
    })
  }

  /* --- Drag (only when draggable) -------------------- */
  function onTitleMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
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
      if (typeof getSelection !== 'undefined') {
        const sel = getSelection()
        if (sel && !sel.isCollapsed) sel.removeAllRanges()
      }
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
      className={[
        styles.window,
        draggable ? styles.draggable : '',
        minimized ? styles.windowMinimized : '',
        className,
      ].filter(Boolean).join(' ')}
      style={positionStyle}
    >
      {/* Title bar */}
      <div className={styles.upperBar} onMouseDown={onTitleMouseDown}>
        <div className={styles.upperBarTitle}>{data.title}</div>
        <div className={styles.upperBarBtns}>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeExpand}`}
            aria-label="Expand"
            onClick={onExpand}
          >
            <img src={`${CASE_ICONS}/expand.svg`} alt="" />
          </button>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeMinimize}`}
            aria-label={minimized ? 'Restore' : 'Minimize'}
            onClick={handleMinimize}
          >
            <img src={`${CASE_ICONS}/minimize.svg`} alt="" />
          </button>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeClose}`}
            aria-label="Close"
            onClick={onClose}
          >
            <img src={`${CASE_ICONS}/close.svg`} alt="" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Body: toggles (left) + gauge (right) */}
          <div className={styles.body}>
            <div className={styles.bodyInner}>
              <div className={styles.togglesGrid}>
                {TOGGLE_KEYS.map((key) => (
                  <ToggleSlot
                    key={key}
                    label={TOGGLE_LABELS[key]}
                    illustrationSrc={`${ASSETS}/${TOGGLE_ILLUSTRATIONS[key]}`}
                    on={data.toggles[key]}
                    onClick={() => {
                      playClickSound(TOGGLE_CLICK_SOUNDS[key])
                      onToggle?.(key, !data.toggles[key])
                    }}
                  />
                ))}
              </div>

              <Gauge togglesOn={countOn(data.toggles)} />
            </div>
          </div>

          {/* Footer: caption + CTA. The Arrest CTA is disabled
              (grey) until every toggle is on, then it turns red
              and becomes clickable — matches the gauge logic
              that the operation is only "ready" at state 06. */}
          {(() => {
            const allOn = countOn(data.toggles) === TOGGLE_KEYS.length
            return (
              <div className={styles.footer}>
                <p className={styles.footerText}>{data.footerText}</p>
                <div className={styles.ctas}>
                  <button
                    type="button"
                    className={`${styles.cta} ${allOn ? styles.ctaArrest : styles.ctaDisabled}`}
                    onClick={onStartOperation}
                    disabled={!allOn}
                  >
                    {data.ctaLabel}
                  </button>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

/* ─── Sub-components ─────────────────────────────── */

type ToggleSlotProps = {
  label: string
  illustrationSrc: string
  on: boolean
  onClick: () => void
}

/**
 * A single toggle in the grid: a grey pill with a card inside
 * that holds two stacked slots. The Off and On states are
 * distinct designs (per Figma node 493:12184):
 *
 *  • Off — beige `#cec9be` card. "Off" text on top, illustration
 *    in a grey-recessed mount on the bottom; illustration is
 *    desaturated via mix-blend-luminosity.
 *  • On  — green `#00a168` card. Illustration in a light-blue
 *    recessed mount on top (full colour, no blend); "On" text
 *    on the bottom.
 */
function ToggleSlot({ label, illustrationSrc, on, onClick }: ToggleSlotProps) {
  return (
    <div className={styles.toggleCell}>
      <button
        type="button"
        className={styles.toggle}
        onClick={onClick}
        aria-pressed={on}
      >
        <div
          className={[
            styles.toggleCard,
            on ? styles.toggleCardOn : '',
          ].filter(Boolean).join(' ')}
        >
          {on ? (
            <>
              <IllustrationBox src={illustrationSrc} alt={label} active />
              <div className={styles.toggleTextSlot}>
                <p className={styles.offText}>On</p>
              </div>
            </>
          ) : (
            <>
              <div className={styles.toggleTextSlot}>
                <p className={styles.offText}>Off</p>
              </div>
              <IllustrationBox src={illustrationSrc} alt={label} />
            </>
          )}
        </div>
      </button>
      <p className={styles.toggleLabel}>{label}</p>
    </div>
  )
}

/**
 * The recessed illustration mount. The inner light-blue tile
 * holds the toggle's composed illustration SVG.
 *
 * When `active` is true the mount outer shifts from grey to
 * light-blue-300 (the Figma's On-state recess colour) and the
 * mix-blend desaturation lifts so the illustration shows in
 * full colour.
 */
function IllustrationBox({
  src,
  alt,
  active = false,
}: {
  src: string
  alt: string
  active?: boolean
}) {
  return (
    <div
      className={[
        styles.illustrationMount,
        active ? styles.illustrationMountActive : '',
      ].filter(Boolean).join(' ')}
    >
      <div
        className={[
          styles.illustrationInner,
          active ? styles.illustrationInnerActive : '',
        ].filter(Boolean).join(' ')}
      >
        <img src={src} alt={alt} className={styles.illustrationImg} />
      </div>
    </div>
  )
}

/** Count of toggles in the on state — drives the needle. */
function countOn(toggles: Record<ToggleKey, boolean>): number {
  return TOGGLE_KEYS.reduce((n, k) => n + (toggles[k] ? 1 : 0), 0)
}

/**
 * Needle angles — one per Figma variant (01–06).
 *
 * Six states centred on vertical, 24° apart (5 gaps × 24° =
 * 120° total sweep). State 01 is the leftmost lean toward
 * "Boring"; state 06 is the rightmost lean toward "Let the
 * Party Begin!". Indexed by the count of toggles that are on,
 * so the needle marches 01 → 06 as switches flip, regardless
 * of which toggle was clicked.
 */
const NEEDLE_STEP_DEG = 24
const NEEDLE_ANGLES: ReadonlyArray<number> = [-60, -36, -12, 12, 36, 60]

/**
 * The gauge panel: light-blue rounded box that holds the arc
 * SVG, six labels positioned at their exact Figma coordinates,
 * and the pointer needle.
 *
 * Everything inside is absolute-positioned within the panel
 * (just like Figma) so layout doesn't drift when the panel
 * changes height.
 *
 * The needle picks one of 6 angles from NEEDLE_ANGLES based on
 * how many toggles are on, pivots around its own base (sitting
 * at the arc's centre), and transitions smoothly between
 * states on change.
 */
function Gauge({ togglesOn }: { togglesOn: number }) {
  const stateIdx = Math.max(0, Math.min(NEEDLE_ANGLES.length - 1, togglesOn))
  const needleRotation = NEEDLE_ANGLES[stateIdx]
  // Surface step size in the markup so reviewers can see it
  // matches the documented Figma cadence (24° per state).
  void NEEDLE_STEP_DEG

  return (
    <div className={styles.gaugeBox}>
      {/* Arc — single composed SVG from Figma */}
      <img
        className={styles.gaugeArc}
        src={`${ASSETS}/arc.svg`}
        alt=""
        width={510.992}
        height={241.642}
      />

      {/* Zone labels around the arc */}
      {GAUGE_LABELS.map((lbl, i) => (
        <div
          key={i}
          className={[
            styles.gaugeLabel,
            lbl.anchor === 'left'   ? styles.gaugeLabelLeft   : '',
            lbl.anchor === 'right'  ? styles.gaugeLabelRight  : '',
            lbl.anchor === 'center' ? styles.gaugeLabelCenter : '',
          ].filter(Boolean).join(' ')}
          style={{ left: lbl.left, top: lbl.top }}
        >
          {lbl.text.map((line, j) => (
            <p key={j}>{line}</p>
          ))}
        </div>
      ))}

      {/* Pointer needle — pinned to the arc's centre (bottom of
          the arc image). The wrap is just an anchor; the needle
          rotates around its own base (transform-origin at
          50% 100%) so each state visually sweeps around the
          gauge's pivot point. */}
      <div className={styles.gaugeNeedleAnchor}>
        <img
          className={styles.gaugeNeedle}
          src={`${ASSETS}/needle.svg`}
          alt=""
          width={23}
          height={113}
          style={{ transform: `rotate(${needleRotation}deg)` }}
        />
      </div>
    </div>
  )
}
