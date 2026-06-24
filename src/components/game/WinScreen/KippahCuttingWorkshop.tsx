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
const CURSOR_OPEN = `${ASSET_ROOT}/Cursor02_Scissors01.svg`
const CURSOR_CLOSED = `${ASSET_ROOT}/Cursor02_Scissors02.svg`
const CURSOR_TRAIL = `${ASSET_ROOT}/trail.svg`
const BACKGROUND_VIDEO = `${ASSET_ROOT}/KippahCutting.mp4`
const SCISSORS_SOUND_SRC = assetUrl('/sounds/Scissors.mp3')
const DEFAULT_WIN_TITLE = 'Win'
const DEFAULT_WIN_FOOTER_TEXT = 'Winning is so good'
const DEFAULT_WIN_CTA_LABEL = 'Love this job, next case!'

const HANDS = [
  `${ASSET_ROOT}/Kippah_hand01.svg`,
  `${ASSET_ROOT}/Kippah_hand02.svg`,
  `${ASSET_ROOT}/Kippah_hand03.svg`,
] as const

const CUT_PIECE_STATES = [
  [],
  [
    { id: 'left01', src: `${ASSET_ROOT}/Kippah_left_01.svg` },
    { id: 'right01', src: `${ASSET_ROOT}/Kippah_right_01.svg` },
  ],
  [
    { id: 'left01', src: `${ASSET_ROOT}/Kippah_left_01.svg` },
    { id: 'right01', src: `${ASSET_ROOT}/Kippah_right_01.svg` },
    { id: 'left02', src: `${ASSET_ROOT}/Kippah_left_02.svg` },
    { id: 'right02', src: `${ASSET_ROOT}/Kippah_right_02.svg` },
  ],
  [
    { id: 'left01', src: `${ASSET_ROOT}/Kippah_left_01.svg` },
    { id: 'right01', src: `${ASSET_ROOT}/Kippah_right_01.svg` },
    { id: 'left02', src: `${ASSET_ROOT}/Kippah_left_02.svg` },
    { id: 'right02', src: `${ASSET_ROOT}/Kippah_right_02.svg` },
    { id: 'left03', src: `${ASSET_ROOT}/Kippah_left_03.svg` },
    { id: 'right03', src: `${ASSET_ROOT}/Kippah_right_03.svg` },
  ],
] as const

const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov)(\?.*)?$/i
const PIECE_CLASSES = {
  left01: 'pieceLeft01',
  left02: 'pieceLeft02',
  left03: 'pieceLeft03',
  right01: 'pieceRight01',
  right02: 'pieceRight02',
  right03: 'pieceRight03',
} as const

type PieceId = keyof typeof PIECE_CLASSES
type PieceLayout = {
  x: number
  y: number
  rotation: number
}

const PIECE_BASE_ROTATIONS: Record<PieceId, number> = {
  left01: -13,
  left02: 12,
  left03: -15,
  right01: -6,
  right02: 10,
  right03: -9,
}

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min))
}

function randomPercentBetween(min: number, max: number) {
  return Number((min + Math.random() * (max - min)).toFixed(2))
}

function randomPieceLayout(pieceId: PieceId): PieceLayout {
  const isLeftPiece = pieceId.startsWith('left')
  return {
    x: randomPercentBetween(isLeftPiece ? -16 : -10, isLeftPiece ? 16 : 14),
    y: randomPercentBetween(-11, 11),
    rotation: PIECE_BASE_ROTATIONS[pieceId] + randomBetween(-9, 9),
  }
}

function randomizePieces(pieces: readonly { id: PieceId; src: string }[]) {
  return pieces.reduce<Record<PieceId, PieceLayout>>(
    (layouts, piece) => ({
      ...layouts,
      [piece.id]: randomPieceLayout(piece.id),
    }),
    {} as Record<PieceId, PieceLayout>,
  )
}

function getLocalPercent(
  clientX: number,
  clientY: number,
  element: HTMLElement,
) {
  const rect = element.getBoundingClientRect()
  const scaleX = element.offsetWidth / rect.width
  const scaleY = element.offsetHeight / rect.height

  return {
    x: (((clientX - rect.left) * scaleX) / element.offsetWidth) * 100,
    y: (((clientY - rect.top) * scaleY) / element.offsetHeight) * 100,
  }
}

export interface KippahCuttingWorkshopProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  debug?: boolean
}

export function KippahCuttingWorkshop({
  className,
  src: srcOverride,
  blobId,
  onComplete,
  winTitle = DEFAULT_WIN_TITLE,
  winFooterText = DEFAULT_WIN_FOOTER_TEXT,
  winCtaLabel = DEFAULT_WIN_CTA_LABEL,
  debug = false,
}: KippahCuttingWorkshopProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'kippah-cutting-workshop',
    src: srcOverride ?? BACKGROUND_VIDEO,
    blobId,
  })

  const [handStep, setHandStep] = useState(0)
  const [cutStep, setCutStep] = useState(0)
  const [pieceLayouts, setPieceLayouts] = useState<
    Partial<Record<PieceId, PieceLayout>>
  >({})
  const [cursorClosed, setCursorClosed] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 69.68, y: 102.51 })
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

  function playScissorsSound() {
    const audio = new Audio(SCISSORS_SOUND_SRC)
    audio.play().catch(() => { /* autoplay blocked — ignore */ })
  }

  function advanceCut() {
    playScissorsSound()
    flashCursor()
    setHandStep((current) => (current + 1) % HANDS.length)
    setCutStep((current) => {
      const next = Math.min(current + 1, CUT_PIECE_STATES.length - 1)
      setPieceLayouts(randomizePieces(CUT_PIECE_STATES[next]))
      return next
    })
  }

  function updateCursor(e: PointerEvent<HTMLDivElement>) {
    setCursorPos(getLocalPercent(e.clientX, e.clientY, e.currentTarget))
  }

  function onScreenClick(e: MouseEvent<HTMLDivElement>) {
    setCursorPos(getLocalPercent(e.clientX, e.clientY, e.currentTarget))
    advanceCut()
  }

  const cursorStyle: CSSProperties = {
    left: `${cursorPos.x}%`,
    top: `${cursorPos.y}%`,
  }
  const pieces = CUT_PIECE_STATES[cutStep]
  const hand = HANDS[handStep]
  const isVideoBackground = VIDEO_EXTENSIONS.test(bgSrc)

  return (
    <div
      className={[styles.window, className].filter(Boolean).join(' ')}
      data-node="win-kippah-cutting-workshop"
    >
      <div className={styles.upperBar}>
        <span className={styles.upperBarTitle}>{winTitle}</span>
        <div className={styles.upperBarBtns}>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeClose}`}
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              onComplete?.()
            }}
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
        onClick={onScreenClick}
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
          {pieces.map((piece) => (
            <img
              key={piece.id}
              className={[
                styles.fabricPiece,
                styles[PIECE_CLASSES[piece.id]],
              ].join(' ')}
              src={piece.src}
              alt=""
              draggable={false}
              style={{
                '--piece-x': `${pieceLayouts[piece.id]?.x ?? 0}%`,
                '--piece-y': `${pieceLayouts[piece.id]?.y ?? 0}%`,
                '--piece-rotation': `${
                  pieceLayouts[piece.id]?.rotation ??
                  PIECE_BASE_ROTATIONS[piece.id]
                }deg`,
              } as CSSProperties}
            />
          ))}
          <button
            type="button"
            className={styles.handButton}
            aria-label="Cut kippah"
          >
            <img
              className={styles.hand}
              src={hand}
              alt=""
              draggable={false}
            />
          </button>
        </div>
        <img
          className={styles.cursorTrail}
          src={CURSOR_TRAIL}
          alt=""
          draggable={false}
          style={cursorStyle}
          aria-hidden="true"
        />
        <img
          className={styles.cursor}
          src={cursorClosed ? CURSOR_CLOSED : CURSOR_OPEN}
          alt=""
          draggable={false}
          style={cursorStyle}
          aria-hidden="true"
        />
      </div>
      <div className={styles.footerBar}>
        <p className={styles.footerText}>{winFooterText}</p>
        <button
          type="button"
          className={styles.footerCta}
          onClick={(e) => {
            e.stopPropagation()
            onComplete?.()
          }}
        >
          {winCtaLabel}
        </button>
      </div>
    </div>
  )
}
