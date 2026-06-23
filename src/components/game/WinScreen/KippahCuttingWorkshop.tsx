import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { assetUrl } from '@/lib/paths'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './KippahCuttingWorkshop.module.css'

const ASSET_ROOT = assetUrl('/images/win-screens/KippahCutting')
const CURSOR_OPEN = `${ASSET_ROOT}/Cursor_Scissors01.svg`
const CURSOR_CLOSED = `${ASSET_ROOT}/Cursor_Scissors02.svg`

const HANDS = [
  `${ASSET_ROOT}/Kippah_hand01.svg`,
  `${ASSET_ROOT}/Kippah_hand02.svg`,
  `${ASSET_ROOT}/Kippah_hand03.svg`,
] as const

const CUT_STATES = [
  {
    hand: HANDS[0],
    pieces: [],
  },
  {
    hand: HANDS[1],
    pieces: [
      { id: 'left01', src: `${ASSET_ROOT}/Kippah_left_01.svg` },
      { id: 'right01', src: `${ASSET_ROOT}/Kippah_right_01.svg` },
    ],
  },
  {
    hand: HANDS[2],
    pieces: [
      { id: 'left01', src: `${ASSET_ROOT}/Kippah_left_01.svg` },
      { id: 'right01', src: `${ASSET_ROOT}/Kippah_right_01.svg` },
      { id: 'left02', src: `${ASSET_ROOT}/Kippah_left_02.svg` },
    ],
  },
  {
    hand: HANDS[0],
    pieces: [
      { id: 'left01', src: `${ASSET_ROOT}/Kippah_left_01.svg` },
      { id: 'right01', src: `${ASSET_ROOT}/Kippah_right_01.svg` },
      { id: 'left02', src: `${ASSET_ROOT}/Kippah_left_02.svg` },
      { id: 'left03', src: `${ASSET_ROOT}/Kippah_left_03.svg` },
      { id: 'right02', src: `${ASSET_ROOT}/Kippah_right_02.svg` },
    ],
  },
] as const

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov)(\?.*)?$/i
const PIECE_CLASSES = {
  left01: 'pieceLeft01',
  left02: 'pieceLeft02',
  left03: 'pieceLeft03',
  right01: 'pieceRight01',
  right02: 'pieceRight02',
} as const

export interface KippahCuttingWorkshopProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  debug?: boolean
}

export function KippahCuttingWorkshop({
  className,
  src: srcOverride,
  blobId,
  onComplete,
  debug = false,
}: KippahCuttingWorkshopProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'kippah-cutting-workshop',
    src: srcOverride,
    blobId,
  })

  const [cutStep, setCutStep] = useState(0)
  const [cursorClosed, setCursorClosed] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 864, y: 715 })
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  function flashCursor() {
    setCursorClosed(true)
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setCursorClosed(false)
      timeoutRef.current = null
    }, 1000)
  }

  function advanceCut() {
    flashCursor()
    setCutStep((current) => {
      const next = (current + 1) % CUT_STATES.length
      if (next === CUT_STATES.length - 1) onComplete?.()
      return next
    })
  }

  function updateCursor(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  function onHandClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const parentRect = e.currentTarget.offsetParent?.getBoundingClientRect()
    const origin = parentRect ?? rect
    setCursorPos({
      x: e.clientX - origin.left,
      y: e.clientY - origin.top,
    })
    advanceCut()
  }

  const cursorStyle: CSSProperties = {
    left: cursorPos.x,
    top: cursorPos.y,
  }
  const state = CUT_STATES[cutStep]
  const isVideoBackground = VIDEO_EXTENSIONS.test(bgSrc)

  return (
    <div
      className={[styles.window, className].filter(Boolean).join(' ')}
      data-node="win-kippah-cutting-workshop"
    >
      <div className={styles.upperBar}>
        <span className={styles.upperBarTitle}>Win</span>
        <div className={styles.upperBarBtns}>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeExpand}`}
            aria-label="Expand"
          >
            <img src={assetUrl('/images/case-window/expand.svg')} alt="" />
          </button>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeMinimize}`}
            aria-label="Minimize"
          >
            <img src={assetUrl('/images/case-window/minimize.svg')} alt="" />
          </button>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeClose}`}
            aria-label="Close"
          >
            <img src={assetUrl('/images/case-window/close.svg')} alt="" />
          </button>
        </div>
      </div>
      <div
        className={[styles.screen, debug ? styles.debug : '']
          .filter(Boolean)
          .join(' ')}
        onPointerEnter={(e) => {
          updateCursor(e)
        }}
        onPointerMove={updateCursor}
      >
        {isVideoBackground ? (
          <video
            className={styles.scene}
            src={bgSrc}
            aria-label={label}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            className={styles.scene}
            src={bgSrc}
            alt={label}
            draggable={false}
            onError={handleError}
          />
        )}
        <div className={styles.cuttingPreview}>
          {state.pieces.map((piece) => (
            <img
              key={piece.id}
              className={[
                styles.fabricPiece,
                styles[PIECE_CLASSES[piece.id]],
              ].join(' ')}
              src={piece.src}
              alt=""
              draggable={false}
            />
          ))}
          <button
            type="button"
            className={styles.handButton}
            aria-label="Cut kippah"
            onClick={onHandClick}
          >
            <img
              className={styles.hand}
              src={state.hand}
              alt=""
              draggable={false}
            />
          </button>
        </div>
        <img
          className={styles.cursor}
          src={cursorClosed ? CURSOR_CLOSED : CURSOR_OPEN}
          alt=""
          draggable={false}
          style={cursorStyle}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
