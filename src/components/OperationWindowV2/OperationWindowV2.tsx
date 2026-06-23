import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { OPERATION_SOUND_NONE } from '@/lib/operationSounds'
import styles from './OperationWindowV2.module.css'

/* ============================================================
   OperationWindowV2 — counter-based redesign of the Operation
   planner (Figma node 575:24765).

   Differences vs. OperationWindow:
     • Each item is a quantity stepper (− N +) instead of an
       on/off toggle. Tile is light-blue-200 (no Off/On colour
       split).
     • Header lives inside the body: "Start operation" caption
       on the left, shopping-cart badge on the right showing
       the total count across all items.
     • Footer carries only the "Arrest Arab" CTA — caption is
       gone (the header took its place).
     • Gauge geometry is unchanged; needle is driven by the
       count of items that have at least one selected.

   This is an additive component — the original OperationWindow
   remains in place for callers that still expect the toggle
   API.
   ============================================================ */

const CASE_ICONS = '/images/case-window'
const ASSETS = '/images/operation-window'

export const ITEM_KEYS = ['boss', 'forces', 'dogs', 'press', 'blindfold'] as const
export type OperationItemKey = (typeof ITEM_KEYS)[number]

export const ITEM_LABELS: Record<OperationItemKey, string> = {
  boss: 'Minister',
  forces: 'Forces',
  dogs: 'Dogs',
  press: 'Press',
  blindfold: 'Blindfold',
}

const ITEM_ILLUSTRATIONS: Record<OperationItemKey, string> = {
  boss: 'Boss.svg',
  forces: 'Forces.svg',
  dogs: 'Dog.svg',
  press: 'Press.svg',
  blindfold: 'Blindfold.svg',
}

/** Per-item upper bound. The Minister can only be brought
 *  along once (he's a single person), every other resource
 *  scales up to a small platoon (9). */
const ITEM_MAX: Record<OperationItemKey, number> = {
  boss: 1,
  forces: 9,
  dogs: 9,
  press: 9,
  blindfold: 9,
}

/** Click sound per item — same mapping as v1 so users get a
 *  familiar audio cue when changing a quantity. */
const ITEM_CLICK_SOUNDS: Record<OperationItemKey, string> = {
  boss:      '/sounds/Light Switch 01.wav',
  forces:    '/sounds/Light Switch 02.wav',
  dogs:      '/sounds/Light Switch 03.wav',
  press:     '/sounds/Light Switch 01.wav',
  blindfold: '/sounds/Light Switch 02.wav',
}

function playClickSound(url: string) {
  try {
    const a = new Audio(url)
    a.play().catch(() => { /* autoplay blocked — ignore */ })
  } catch {
    /* ignore */
  }
}

/** Gauge labels — same Figma coordinates as v1. */
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

/** Six needle angles, one per gauge state. Spans a full 180°
 *  in 36° steps so the needle lands exactly on each arc tick:
 *    0 = Boring (-90°), 1 = Slightly Less Boring (-54°),
 *    2 = Getting Interesting (-18°), 3 = Tactical Entertainment (+18°),
 *    4 = Now You Start Talking (+54°), 5 = Let the Party Begin! (+90°). */
const NEEDLE_ANGLES: ReadonlyArray<number> = [-90, -54, -18, 18, 54, 90]

export type OperationCounters = Record<OperationItemKey, number>

export type OperationWindowV2Data = {
  title: string
  /** "Start operation" caption in the body header. */
  headerText: string
  /** CTA label on the right — e.g. "Arrest Arab". */
  ctaLabel: string
  counters: OperationCounters
  /**
   * Per-item click-sound override. Each entry is a public URL
   * string (e.g. "/sounds/Light Switch 01.wav") OR the
   * `OPERATION_SOUND_NONE` sentinel to silence that item.
   * Missing keys fall back to `ITEM_CLICK_SOUNDS` defaults.
   */
  itemSounds?: Partial<Record<OperationItemKey, string>>
}

export const DEFAULT_OPERATION_V2_DATA: OperationWindowV2Data = {
  title: 'Operation',
  headerText: 'Start operation',
  ctaLabel: 'Arrest Arab',
  counters: {
    boss: 0,
    forces: 0,
    dogs: 0,
    press: 0,
    blindfold: 0,
  },
}

type OperationWindowV2Props = {
  data?: OperationWindowV2Data
  onClose?: () => void
  onExpand?: () => void
  onMinimizeChange?: (minimized: boolean) => void
  onChangeCounter?: (key: OperationItemKey, value: number) => void
  onStartOperation?: () => void
  draggable?: boolean
  className?: string
}

/** A single "fly-to-cart" animation. The illustration is cloned
 *  as a floating ghost positioned at the tile's rect. A CSS
 *  keyframe animation drives it to the cart with scale-down +
 *  fade — pure CSS so we don't depend on a React state flip
 *  landing inside the right paint frame. */
type FlyAnim = {
  id: number
  src: string
  /** Where the ghost starts (viewport coords). */
  from: { x: number; y: number; w: number; h: number }
  /** Delta from `from`'s centre to the cart centre. */
  dx: number
  dy: number
}

const FLY_DURATION_MS = 600

export function OperationWindowV2({
  data = DEFAULT_OPERATION_V2_DATA,
  onClose,
  onExpand,
  onMinimizeChange,
  onChangeCounter,
  onStartOperation,
  draggable = false,
  className,
}: OperationWindowV2Props) {
  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  const windowRef = useRef<HTMLDivElement | null>(null)

  /** Refs to each item's illustration tile, used as the source
   *  rect for the fly-to-cart animation. */
  const tileRefs = useRef<Record<OperationItemKey, HTMLDivElement | null>>({
    boss: null, forces: null, dogs: null, press: null, blindfold: null,
  })
  const cartRef = useRef<HTMLDivElement | null>(null)

  const [flying, setFlying] = useState<FlyAnim[]>([])
  const flyIdRef = useRef(0)

  function handleMinimize() {
    setMinimized((m) => {
      onMinimizeChange?.(!m)
      return !m
    })
  }

  /** Spawn a fly-to-cart ghost from the item tile to the cart
   *  icon. Captures rects at click time so the animation always
   *  starts where the user clicked, even if the layout shifts. */
  function spawnFly(key: OperationItemKey) {
    const tile = tileRefs.current[key]
    const cart = cartRef.current
    if (!tile || !cart) return
    const t = tile.getBoundingClientRect()
    const c = cart.getBoundingClientRect()
    const tileCx = t.left + t.width / 2
    const tileCy = t.top + t.height / 2
    const cartCx = c.left + c.width / 2
    const cartCy = c.top + c.height / 2
    const id = ++flyIdRef.current
    const anim: FlyAnim = {
      id,
      src: `${ASSETS}/${ITEM_ILLUSTRATIONS[key]}`,
      from: { x: t.left, y: t.top, w: t.width, h: t.height },
      dx: cartCx - tileCx,
      dy: cartCy - tileCy,
    }
    setFlying((list) => [...list, anim])
    window.setTimeout(() => {
      setFlying((list) => list.filter((f) => f.id !== id))
    }, FLY_DURATION_MS + 50)
  }

  function adjust(key: OperationItemKey, delta: number) {
    const current = data.counters[key] ?? 0
    const max = ITEM_MAX[key]
    const next = Math.max(0, Math.min(max, current + delta))
    if (next === current) return
    // Per-item sound override wins over the default. The
    // OPERATION_SOUND_NONE sentinel silences this item.
    const overrideSrc = data.itemSounds?.[key]
    const soundSrc =
      overrideSrc === OPERATION_SOUND_NONE
        ? null
        : (overrideSrc ?? ITEM_CLICK_SOUNDS[key])
    if (soundSrc) playClickSound(soundSrc)
    if (delta > 0) spawnFly(key)
    onChangeCounter?.(key, next)
  }

  /* --- Drag (only when draggable) ------------------ */
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

  const cartTotal = ITEM_KEYS.reduce((n, k) => n + (data.counters[k] ?? 0), 0)
  const itemsWithCount = ITEM_KEYS.reduce(
    (n, k) => n + ((data.counters[k] ?? 0) > 0 ? 1 : 0),
    0,
  )
  const allPicked = itemsWithCount === ITEM_KEYS.length

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
          <div className={styles.body}>
            {/* Header row: "Start operation" + cart badge */}
            <div className={styles.headerRow}>
              <p className={styles.headerTitle}>{data.headerText}</p>
              <div className={styles.cartWrap}>
                <div
                  ref={cartRef}
                  className={styles.cart}
                  aria-label={`Cart total ${cartTotal}`}
                >
                  <CartIcon />
                </div>
                <div className={styles.cartBadge}>{cartTotal}</div>
              </div>
            </div>

            {/* Main row: item grid + gauge */}
            <div className={styles.mainRow}>
              <div className={styles.itemsGrid}>
                {ITEM_KEYS.map((key) => (
                  <ItemCell
                    key={key}
                    label={ITEM_LABELS[key]}
                    illustrationSrc={`${ASSETS}/${ITEM_ILLUSTRATIONS[key]}`}
                    value={data.counters[key] ?? 0}
                    max={ITEM_MAX[key]}
                    tileRef={(el) => { tileRefs.current[key] = el }}
                    onDec={() => adjust(key, -1)}
                    onInc={() => adjust(key, +1)}
                  />
                ))}
              </div>

              <Gauge picked={itemsWithCount} />
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={`${styles.cta} ${allPicked ? styles.ctaArrest : styles.ctaDisabled}`}
              onClick={onStartOperation}
              disabled={!allPicked}
            >
              {data.ctaLabel}
            </button>
          </div>
        </>
      )}

      {/* Fly-to-cart ghosts. Position-fixed at the tile's start
          rect; the Web Animations API drives each ghost to the
          cart centre with a scale-down and fade. WAAPI lets us
          interpolate concrete pixel deltas without depending on
          CSS @property support for variable-driven transforms.
          The ghosts render last so they paint above the rest of
          the window without affecting layout. */}
      {flying.map((f) => (
        <FlyGhost key={f.id} anim={f} />
      ))}
    </div>
  )
}

/** A single in-flight ghost. Runs its Web Animation as soon as
 *  the <img> mounts; React unmounts the element when the
 *  parent removes the entry from `flying`. */
function FlyGhost({ anim }: { anim: FlyAnim }) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    el.animate(
      [
        { transform: 'translate(0, 0) scale(1)',                                opacity: 1, offset: 0 },
        { transform: `translate(${anim.dx}px, ${anim.dy}px) scale(0.15)`,       opacity: 0, offset: 1 },
      ],
      {
        duration: FLY_DURATION_MS,
        easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
        fill: 'forwards',
      },
    )
  }, [anim.dx, anim.dy])
  return (
    <img
      ref={imgRef}
      src={anim.src}
      alt=""
      aria-hidden="true"
      className={styles.flyGhost}
      style={{
        left: anim.from.x,
        top: anim.from.y,
        width: anim.from.w,
        height: anim.from.h,
      }}
    />
  )
}

/* ─── Sub-components ─────────────────────────────── */

type ItemCellProps = {
  label: string
  illustrationSrc: string
  value: number
  max: number
  tileRef: (el: HTMLDivElement | null) => void
  onDec: () => void
  onInc: () => void
}

function ItemCell({
  label,
  illustrationSrc,
  value,
  max,
  tileRef,
  onDec,
  onInc,
}: ItemCellProps) {
  return (
    <div className={styles.itemCell}>
      <div ref={tileRef} className={styles.illustration}>
        <img src={illustrationSrc} alt={label} />
      </div>

      <div className={styles.counter}>
        <button
          type="button"
          className={styles.counterBtn}
          aria-label={`Decrease ${label}`}
          onClick={onDec}
          disabled={value <= 0}
        >
          <MinusIcon />
        </button>
        <span className={styles.counterValue}>{value}</span>
        <button
          type="button"
          className={styles.counterBtn}
          aria-label={`Increase ${label}`}
          onClick={onInc}
          disabled={value >= max}
        >
          <PlusIcon />
        </button>
      </div>

      <p className={styles.itemLabel}>{label}</p>
    </div>
  )
}

function MinusIcon() {
  return (
    <svg width="16" height="4" viewBox="0 0 16 4" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0" width="16" height="3" fill="#171717" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="6.5" width="16" height="3" fill="#171717" />
      <rect x="6.5" y="0" width="3" height="16" fill="#171717" />
    </svg>
  )
}

/** Stylised storefront/cart icon — flat, black-on-white,
 *  mirrors the Figma's hand-drawn cart silhouette. */
function CartIcon() {
  return (
    <svg width="47" height="47" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5 11 H10 L13 30 H38 L41 16 H13"
        stroke="#171717"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="17" cy="38" r="3" stroke="#171717" strokeWidth="2.5" fill="none" />
      <circle cx="34" cy="38" r="3" stroke="#171717" strokeWidth="2.5" fill="none" />
    </svg>
  )
}

/** Same gauge geometry as v1, driven by item-pick count. */
function Gauge({ picked }: { picked: number }) {
  const stateIdx = Math.max(0, Math.min(NEEDLE_ANGLES.length - 1, picked))
  const needleRotation = NEEDLE_ANGLES[stateIdx]

  return (
    <div className={styles.gaugeBox}>
      <img
        className={styles.gaugeArc}
        src={`${ASSETS}/arc.svg`}
        alt=""
        width={510.992}
        height={241.642}
      />

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
