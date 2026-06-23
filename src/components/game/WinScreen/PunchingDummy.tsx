import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { assetUrl } from '@/lib/paths'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './PunchingDummy.module.css'

/* ═══════════════════════════════════════════════
   PUNCHING DUMMY win screen (tumbler toy).

   Background: the bundled / editor-overridable
   coupon. Stays put.

   Toy: a single <canvas> overlaid on the
   background. On mount both gifs are decoded
   frame-by-frame via the browser's `ImageDecoder`
   API so the runtime can pick ANY frame on demand.
   No more autoplaying gifs:

     - idle      → frame 0 of the forward sequence
                   (the resting upright pose).
     - dragging  → forward frames, scrubbed by tilt.
                   Frame index = |tilt|/MAX_TILT, so
                   the gif advances at the same rate
                   as the player drags. Start = frame
                   0, peak = last frame.
     - returning → reverse frames, scrubbed by the
                   wobble's elapsed time. Same
                   canvas — no element swap, no
                   blank frame on the transition.

   The wrapper around the canvas is what gets
   rotated (live transform while dragging, wobble
   keyframe while returning). Decoupling rotation
   (CSS) from frame selection (JS) lets the gif
   speed reflect the rotation speed naturally.
════════════════════════════════════════════════ */

const TOY_FORWARD_SRC = assetUrl('/images/win-screens/PunchingDummy/PunchingDummy_dummy_forward.gif')
const TOY_REVERSE_SRC = assetUrl('/images/win-screens/PunchingDummy/PunchingDummy_dummy_reverse.gif')

// Toy footprint on top of the background, as % of the wrapper, with
// an absolute horizontal nudge applied on top (so the toy sits flush
// against the coupon art regardless of viewport width). Sized so the
// wrapper aspect (~0.31) lines up with the gif's tall-and-skinny
// aspect (0.31 × 1920/1080 ≈ 0.55, gif is 410/734 = 0.56) — that way
// the canvas fills the wrapper without big object-fit letterbox bars.
// Tune once you can see it on screen — pass `debug` to outline the
// toy and hotspot.
const TOY = { x: 47, y: 12, width: 24, height: 76, offsetX: 0 }

// Hard cap on the live tilt so a long drag doesn't lay the toy on its
// side.
const MAX_TILT_DEG = 45

// Degrees of tilt per CSS pixel of horizontal drag.
const TILT_PER_PX = 0.25

/* Decode a GIF into an array of ImageBitmap frames using the browser's
 * ImageDecoder API. Returns an empty array on browsers without support
 * (the toy just won't render — caller can decide how to handle that).
 * Each frame is sized to the GIF's native canvas; the renderer scales
 * it via CSS. */
async function decodeGifFrames(url: string): Promise<ImageBitmap[]> {
  if (typeof ImageDecoder === 'undefined') {
    console.warn(
      '[PunchingDummy] ImageDecoder API not available — toy GIF cannot be scrubbed',
    )
    return []
  }
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' })
  await decoder.tracks.ready
  const track = decoder.tracks.selectedTrack
  if (!track) return []
  const frameCount = track.frameCount
  const frames: ImageBitmap[] = []
  for (let i = 0; i < frameCount; i++) {
    const result = await decoder.decode({ frameIndex: i })
    const bitmap = await createImageBitmap(result.image)
    frames.push(bitmap)
    result.image.close()
  }
  return frames
}

export interface PunchingDummyProps {
  className?: string
  /** Background image override — legacy per-node data URL path. */
  src?: string
  /** IndexedDB blob id for a per-node uploaded background. */
  blobId?: string
  /** Fires when a wobble-back finishes. The win stop's Next button is
   *  independent of this; advancing is still up to the player. */
  onComplete?: () => void
  /** Outline the toy + hotspot while tuning coordinates. */
  debug?: boolean
}

export function PunchingDummy({
  className,
  src: srcOverride,
  blobId,
  onComplete,
  debug = false,
}: PunchingDummyProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'punching-dummy',
    src: srcOverride,
    blobId,
  })

  // Live tilt while the player is dragging (degrees).
  const [tilt, setTilt] = useState(0)
  // Toy sequence:
  //   'idle'      → static frame 0 (resting pose)
  //   'dragging'  → forward frames, scrubbed by |tilt|
  //   'returning' → reverse frames, scrubbed by elapsed time
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'returning'>('idle')
  // Decoded gif frames. Populated once at mount.
  const [forwardFrames, setForwardFrames] = useState<ImageBitmap[]>([])
  const [reverseFrames, setReverseFrames] = useState<ImageBitmap[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ startX: number } | null>(null)
  // Mirrors for use inside persistent event listeners.
  const tiltRef = useRef(0)
  const phaseRef = useRef<'idle' | 'dragging' | 'returning'>('idle')
  // Angle captured at release — drives the wobble keyframe magnitude.
  const releaseAngleRef = useRef(0)

  function setLiveTilt(value: number) {
    tiltRef.current = value
    setTilt(value)
  }

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Decode both gifs once on mount.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      decodeGifFrames(TOY_FORWARD_SRC),
      decodeGifFrames(TOY_REVERSE_SRC),
    ]).then(([fwd, rev]) => {
      if (cancelled) return
      setForwardFrames(fwd)
      setReverseFrames(rev)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Once the frames arrive, set canvas dimensions to match the source
  // (so drawImage doesn't need to be told the size) and draw the idle
  // pose so something visible appears immediately.
  useEffect(() => {
    if (!forwardFrames.length) return
    const canvas = canvasRef.current
    if (!canvas) return
    const f0 = forwardFrames[0]
    canvas.width = f0.width
    canvas.height = f0.height
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.drawImage(f0, 0, 0)
  }, [forwardFrames])

  function onHotspotMouseDown(e: React.MouseEvent) {
    // Ignore taps while the toy is still wobbling back — wait for it
    // to settle so each push reads as its own gesture.
    if (phase === 'returning') return
    e.stopPropagation()
    dragRef.current = { startX: e.clientX }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const angle = Math.max(
        -MAX_TILT_DEG,
        Math.min(MAX_TILT_DEG, dx * TILT_PER_PX),
      )
      setLiveTilt(angle)
      if (phaseRef.current === 'idle') {
        setPhase('dragging')
      }
    }
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      if (phaseRef.current === 'dragging') {
        releaseAngleRef.current = tiltRef.current
        setPhase('returning')
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Wobble duration scales with how hard the toy was pushed.
  const strength = Math.abs(releaseAngleRef.current)
  const settleDurationMs = 500 + Math.round(strength * 15)

  // Idle / dragging: pick the frame from `tilt` (or 0 when idle) and
  // draw it. Returning is handled by the RAF loop below; this effect
  // intentionally doesn't touch the canvas while returning so the two
  // don't fight over it.
  useEffect(() => {
    if (phase === 'returning') return
    const canvas = canvasRef.current
    if (!canvas || !forwardFrames.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio =
      phase === 'idle' ? 0 : Math.min(1, Math.abs(tilt) / MAX_TILT_DEG)
    const idx = Math.min(
      forwardFrames.length - 1,
      Math.floor(ratio * (forwardFrames.length - 1)),
    )
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(forwardFrames[idx], 0, 0)
  }, [phase, tilt, forwardFrames])

  // Returning: scrub the reverse frames by elapsed time so the gif
  // speed matches the wobble duration (which scales with release
  // strength). Same canvas as the forward draws — no element swap,
  // no blank frame on the transition.
  useEffect(() => {
    if (phase !== 'returning') return
    if (reverseFrames.length === 0) {
      // No frames decoded yet — just wait the duration and settle.
      const t = window.setTimeout(() => {
        setLiveTilt(0)
        releaseAngleRef.current = 0
        setPhase('idle')
        onComplete?.()
      }, settleDurationMs)
      return () => window.clearTimeout(t)
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const start = performance.now()
    let rafId = 0

    function tick() {
      const elapsed = performance.now() - start
      const progress = Math.min(1, elapsed / settleDurationMs)
      if (ctx && canvas) {
        const idx = Math.min(
          reverseFrames.length - 1,
          Math.floor(progress * (reverseFrames.length - 1)),
        )
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(reverseFrames[idx], 0, 0)
      }
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        // Finished — settle back to idle. The idle draw effect will
        // then draw frame 0 of the forward set (matching the resting
        // pose) on the next render.
        setLiveTilt(0)
        releaseAngleRef.current = 0
        setPhase('idle')
        onComplete?.()
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [phase, reverseFrames, settleDurationMs, onComplete])

  // Toy positioning lives on the outer wrapper. Pivot is bottom-center
  // (50% 100%) so the toy hinges at its base like a real tumbler.
  const wrapperPositioning: CSSProperties = {
    left: `calc(${TOY.x}% + ${TOY.offsetX}px)`,
    top: `${TOY.y}%`,
    width: `${TOY.width}%`,
    height: `${TOY.height}%`,
  }
  const wrapperStyle: CSSProperties =
    phase === 'returning'
      ? {
          ...wrapperPositioning,
          ['--toy-tilt' as never]: `${releaseAngleRef.current}deg`,
          ['--toy-settle-duration' as never]: `${settleDurationMs}ms`,
        }
      : {
          ...wrapperPositioning,
          transform: `rotate(${tilt}deg)`,
        }

  return (
    <div
      className={[styles.screen, className].filter(Boolean).join(' ')}
      data-node="win-punching-dummy"
    >
      <img
        className={styles.scene}
        src={bgSrc}
        alt={label}
        draggable={false}
        onError={handleError}
      />
      {/* Wrapper owns rotation. The single inner canvas is redrawn on
          each tilt/phase change (and on each RAF tick while returning),
          so swaps between forward and reverse never blank out. */}
      <div
        className={[
          styles.toyWrapper,
          phase === 'returning' ? styles.toyWrapperReturning : '',
          debug ? styles.toyDebug : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={wrapperStyle}
        data-phase={phase}
      >
        <canvas
          ref={canvasRef}
          className={styles.toyImage}
          role="img"
          aria-label=""
        />
      </div>
      {/* Hotspot stays in the original rectangle even when the toy is
          tilted — the player grabs the resting spot. */}
      <div
        className={[styles.hotspot, debug ? styles.hotspotDebug : '']
          .filter(Boolean)
          .join(' ')}
        style={wrapperPositioning}
        role="button"
        tabIndex={0}
        aria-label="Push the toy"
        onMouseDown={onHotspotMouseDown}
      />
    </div>
  )
}
