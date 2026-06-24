import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { pushBgMusicDuck, popBgMusicDuck } from '@/lib/bgMusic'
import { assetUrl } from '@/lib/paths'
import styles from './FootageWindow.module.css'

/* ============================================================
   FootageWindow — CCTV-style evidence viewer.

   Pixel-perfect implementation of three Figma frames that share the
   same window chrome:
     - "Footage_window_grafitti"        (node 431:11224) → 'graffiti'
     - "Footage_window_jewish_violence" (node 450:10818) → 'jewish-violence'
     - "Footage_indecent_exposure"      (node 486:20465) → 'indecent-exposure'

   The chrome title bar mirrors CaseWindow (green expand / yellow
   minimize / red close) and uses the same icon SVGs from
   /images/case-window/.

   The body (the "sketch") is a single 842×474 SVG export per variant
   — the designer's source of truth — picked from VARIANT_SRC below.
   Timestamps, tag text, and all scene composition live inside those
   SVGs, so this component does not draw any per-scene DOM.
   ============================================================ */

const CASE_ICONS = assetUrl('/images/case-window')
const FOOTAGE_ASSETS = assetUrl('/images/footage-window')

export type FootageVariant =
  | 'graffiti'
  | 'jewish-violence'
  | 'indecent-exposure'
  | 'graffiti-video'

/** Full-scene SVG per variant (or MP4 for the live-footage variant).
 *  Exported flat at 842×474 from Figma; the video is the same scene
 *  with the suspect actually painting on it. */
const VARIANT_SRC: Record<FootageVariant, string> = {
  'graffiti':          `${FOOTAGE_ASSETS}/Footage_grafitti.svg`,
  'jewish-violence':   `${FOOTAGE_ASSETS}/Footage_jewish_violence.svg`,
  'indecent-exposure': `${FOOTAGE_ASSETS}/Footage_indecent_exposure.svg`,
  'graffiti-video':    `${FOOTAGE_ASSETS}/Graffiti.mp4`,
}

/** Variants whose source is a `<video>` rather than a static image. */
const VIDEO_VARIANTS = new Set<FootageVariant>(['graffiti-video'])

export type FootageWindowData = {
  /** Full string shown in the title bar, e.g. "Video #31931902". The
   *  prefix and id format vary per variant in the source designs. */
  title: string
  /** Reserved — the source SVGs already include the burned-in timestamp. */
  timestamp: string
  /** Reserved — the graffiti source SVG already includes the painted tag. */
  tagText: string
}

export const DEFAULT_FOOTAGE_DATA: FootageWindowData = {
  title: 'Video #31931902',
  timestamp: '2026/05/02  23:44:56 pm',
  tagText: 'Municipality',
}

/** Title shown by the indecent-exposure source design (lowercase prefix). */
export const DEFAULT_INDECENT_EXPOSURE_DATA: FootageWindowData = {
  title: 'footage #31666702',
  timestamp: '2026/05/02  23:44:56 pm',
  tagText: '',
}

type FootageWindowProps = {
  data?: FootageWindowData
  /** Which sketch body to render. Defaults to 'graffiti'. */
  variant?: FootageVariant
  onClose?: () => void
  onExpand?: () => void
  onMinimizeChange?: (minimized: boolean) => void
  /** When true, the window becomes absolute-positioned and draggable by its title bar. */
  draggable?: boolean
  className?: string
}

export function FootageWindow({
  data = DEFAULT_FOOTAGE_DATA,
  variant = 'graffiti',
  onClose,
  onExpand,
  onMinimizeChange,
  draggable = false,
  className,
}: FootageWindowProps) {
  const [minimized, setMinimized] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const isDuckingRef = useRef(false)

  // Drag position. `null` = centered (initial). After first drag, becomes {x,y}.
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
    // Don't start a drag when the click is on a chrome button.
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
      // Keep at least 200px of the window visible inside the viewport.
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
  const isVideoVariant = VIDEO_VARIANTS.has(variant)
  const soundEnabled = isVideoVariant && draggable

  const releaseAudioDuck = useCallback(() => {
    if (!isDuckingRef.current) return
    isDuckingRef.current = false
    popBgMusicDuck()
  }, [])

  const applyAudioDuck = useCallback(() => {
    if (!soundEnabled || isDuckingRef.current) return
    isDuckingRef.current = true
    pushBgMusicDuck()
  }, [soundEnabled])

  const playVideo = useCallback(() => {
    const video = videoRef.current
    if (!video || !isVideoVariant || minimized) return
    video.muted = !soundEnabled
    video.volume = soundEnabled ? 1 : 0
    video.play().catch(() => {
      /* Some browsers still require an extra user gesture for audible media. */
    })
  }, [isVideoVariant, minimized, soundEnabled])

  useEffect(() => {
    if (!isVideoVariant) {
      releaseAudioDuck()
      return
    }

    const video = videoRef.current
    if (!video) return

    if (minimized) {
      video.pause()
      releaseAudioDuck()
      return
    }

    applyAudioDuck()
    playVideo()

    function retryPlay() {
      playVideo()
    }

    window.addEventListener('pointerdown', retryPlay, { once: true })
    window.addEventListener('keydown', retryPlay, { once: true })
    return () => {
      window.removeEventListener('pointerdown', retryPlay)
      window.removeEventListener('keydown', retryPlay)
      releaseAudioDuck()
    }
  }, [applyAudioDuck, isVideoVariant, minimized, playVideo, releaseAudioDuck])

  function handleVideoStopped() {
    releaseAudioDuck()
  }

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
        <div className={styles.upperBarTitle}>{`${data.title} `}</div>
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

      {/* Sketch — the CCTV footage scene. One 842×474 SVG per static
          variant, or a looping `<video>` for live-footage variants. */}
      <div className={styles.sketch}>
        {isVideoVariant ? (
          <video
            ref={videoRef}
            className={styles.sketchImg}
            src={VARIANT_SRC[variant]}
            autoPlay
            loop
            muted={!soundEnabled}
            playsInline
            onCanPlay={playVideo}
            onPause={handleVideoStopped}
            onEnded={handleVideoStopped}
          />
        ) : (
          <img className={styles.sketchImg} src={VARIANT_SRC[variant]} alt="" />
        )}
      </div>
    </div>
  )
}
