import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { assetUrl } from '@/lib/paths'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './PunchingDummyClick.module.css'

/* ═══════════════════════════════════════════════
   PUNCHING DUMMY (CLICK) win screen — tumbler toy,
   click-driven.

   Sibling of PunchingDummy.tsx. Shares the same
   background and forward/reverse gif files; the
   only difference is the interaction model:
     - drag version  → tilt tracks the pointer 1:1
     - click version → click the LEFT half of the
                       toy to tilt left, click the
                       RIGHT half to tilt right.

   Phases:
     - idle      → frame 0 of the forward sequence
     - pressing  → RAF-driven tilt 0 → ±PRESS_TILT_DEG
                   over PRESS_DURATION_MS; forward
                   frames scrub by |tilt|/PRESS_TILT_DEG.
                   Click direction is INVERTED — clicking
                   the LEFT half pushes the toy to the
                   right (+1), clicking the RIGHT half
                   pushes it to the left (-1). Matches
                   the way you'd shove a real punching
                   bag from one side.
     - returning → same wobble settle + reverse frame
                   scrub as PunchingDummy.

   The wrapper around the canvas owns rotation; the
   canvas is redrawn on every tilt/phase change.
════════════════════════════════════════════════ */

const TOY_FORWARD_SRC = assetUrl('/images/win-screens/PunchingDummy/PunchingDummy_dummy_forward.gif')
const TOY_REVERSE_SRC = assetUrl('/images/win-screens/PunchingDummy/PunchingDummy_dummy_reverse.gif')

// Path to a punch-click sound. Leave `undefined` to skip; set to a
// public path and `startPress` will fire it on every hotspot click.
const CLICK_SOUND_SRC: string | undefined = assetUrl('/sounds/Punch.mp3')

// Toy footprint — kept identical to PunchingDummy so both variants line
// up on the same coupon art.
const TOY = { x: 47, y: 12, width: 24, height: 76, offsetX: 0 }

// Peak tilt reached at the end of the press animation. Slightly under
// 45° so the wobble settle has room to overshoot the opposite side
// without going horizontal.
const PRESS_TILT_DEG = 40

// How long the toy takes to swing from 0 to PRESS_TILT_DEG on a click.
const PRESS_DURATION_MS = 180

/* Decode a GIF into an array of ImageBitmap frames using the browser's
 * ImageDecoder API. Mirrors the helper in PunchingDummy — duplicated
 * intentionally so the two variants stay independent. */
async function decodeGifFrames(url: string): Promise<ImageBitmap[]> {
  if (typeof ImageDecoder === 'undefined') {
    console.warn(
      '[PunchingDummyClick] ImageDecoder API not available — toy GIF cannot be scrubbed',
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

export interface PunchingDummyClickProps {
  className?: string
  /** Background image override — legacy per-node data URL path. */
  src?: string
  /** IndexedDB blob id for a per-node uploaded background. */
  blobId?: string
  /** Fires when a wobble-back finishes. The win stop's Next button is
   *  independent of this; advancing is still up to the player. */
  onComplete?: () => void
  /** Outline the toy + hotspots while tuning coordinates. */
  debug?: boolean
}

type Phase = 'idle' | 'pressing' | 'returning'

export function PunchingDummyClick({
  className,
  src: srcOverride,
  blobId,
  onComplete,
  debug = false,
}: PunchingDummyClickProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'punching-dummy-click',
    src: srcOverride,
    blobId,
  })

  const [tilt, setTilt] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [forwardFrames, setForwardFrames] = useState<ImageBitmap[]>([])
  const [reverseFrames, setReverseFrames] = useState<ImageBitmap[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Mirrors for use inside persistent listeners / RAF loops.
  const tiltRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  // -1 for left, +1 for right. Captured at click time and used by the
  // press-animation RAF to drive `tilt`.
  const pressDirRef = useRef<-1 | 1>(1)
  // Angle captured at the END of the press — drives the wobble keyframe.
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

  // Once frames arrive, size the canvas + paint the idle pose so
  // something is visible before the first click.
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

  function playClickSound() {
    if (!CLICK_SOUND_SRC) return
    const audio = new Audio(CLICK_SOUND_SRC)
    // Autoplay may reject before the player has interacted with the
    // page — first click should always pass through, so swallow the
    // error rather than letting it bubble.
    audio.play().catch(() => { /* autoplay blocked — ignore */ })
  }

  function startPress(direction: -1 | 1) {
    // Ignore clicks while the toy is still pressing or wobbling — wait
    // for it to settle so each click reads as its own gesture.
    if (phaseRef.current !== 'idle') return
    pressDirRef.current = direction
    playClickSound()
    setPhase('pressing')
  }

  // Inverted mapping: hitting the LEFT half shoves the toy to the right
  // (+1 tilt), hitting the RIGHT half shoves it to the left (-1).
  function onLeftHotspot(e: React.MouseEvent) {
    e.stopPropagation()
    startPress(1)
  }
  function onRightHotspot(e: React.MouseEvent) {
    e.stopPropagation()
    startPress(-1)
  }

  // PRESSING — RAF loop drives tilt from 0 → ±PRESS_TILT_DEG over
  // PRESS_DURATION_MS. Ease-out so the swing feels weighted at the end.
  useEffect(() => {
    if (phase !== 'pressing') return
    const direction = pressDirRef.current
    const target = direction * PRESS_TILT_DEG
    const start = performance.now()
    let rafId = 0
    function tick() {
      const elapsed = performance.now() - start
      const progress = Math.min(1, elapsed / PRESS_DURATION_MS)
      // ease-out quad
      const eased = 1 - Math.pow(1 - progress, 2)
      setLiveTilt(target * eased)
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        // Hand off to the wobble settle. The 'returning' effect below
        // takes over the tilt + frame scrubbing.
        releaseAngleRef.current = target
        setPhase('returning')
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [phase])

  // Wobble duration scales with how far the toy was tilted at release.
  // Same formula as PunchingDummy so the feel matches across variants.
  const strength = Math.abs(releaseAngleRef.current)
  const settleDurationMs = 500 + Math.round(strength * 15)

  // Idle / pressing: pick the forward frame from `tilt` and draw it.
  // Returning has its own RAF loop below; skip touching the canvas
  // here when returning so the two don't fight over it.
  useEffect(() => {
    if (phase === 'returning') return
    const canvas = canvasRef.current
    if (!canvas || !forwardFrames.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio =
      phase === 'idle' ? 0 : Math.min(1, Math.abs(tilt) / PRESS_TILT_DEG)
    const idx = Math.min(
      forwardFrames.length - 1,
      Math.floor(ratio * (forwardFrames.length - 1)),
    )
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(forwardFrames[idx], 0, 0)
  }, [phase, tilt, forwardFrames])

  // RETURNING — scrub reverse frames by elapsed time so the gif speed
  // matches the wobble duration. Same canvas as the forward draws.
  useEffect(() => {
    if (phase !== 'returning') return
    if (reverseFrames.length === 0) {
      // No frames decoded — just wait the duration and settle.
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
        setLiveTilt(0)
        releaseAngleRef.current = 0
        setPhase('idle')
        onComplete?.()
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [phase, reverseFrames, settleDurationMs, onComplete])

  // Outer wrapper holds positioning + rotation; pivot at the base so
  // rotation reads as a tilt, not a spin.
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

  // Hotspots sit in the original (un-rotated) toy rectangle, split into
  // left and right halves. They stay put while the toy tilts — the
  // player clicks the resting spot, not the swung spot.
  const leftHotspotStyle: CSSProperties = {
    ...wrapperPositioning,
    width: `${TOY.width / 2}%`,
  }
  const rightHotspotStyle: CSSProperties = {
    ...wrapperPositioning,
    left: `calc(${TOY.x + TOY.width / 2}% + ${TOY.offsetX}px)`,
    width: `${TOY.width / 2}%`,
  }

  return (
    <div
      className={[styles.window, className].filter(Boolean).join(' ')}
      data-node="win-punching-dummy-click"
    >
      <div className={styles.upperBar}>
        <span className={styles.upperBarTitle}>Win</span>
        <div className={styles.upperBarBtns}>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeClose}`}
            aria-label="Close"
          >
            <img src={assetUrl('/images/case-window/close.svg')} alt="" />
          </button>
        </div>
      </div>
      <div className={styles.screen}>
        <img
          className={styles.scene}
          src={bgSrc}
          alt={label}
          draggable={false}
          onError={handleError}
        />
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
        {/* Two hotspots — invisible halves of the toy footprint. Click
            to tilt in the matching direction. */}
        <div
          className={[styles.hotspot, debug ? styles.hotspotDebugLeft : '']
            .filter(Boolean)
            .join(' ')}
          style={leftHotspotStyle}
          role="button"
          tabIndex={0}
          aria-label="Hit the toy from the left (it tilts right)"
          onClick={onLeftHotspot}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              startPress(1)
            }
          }}
        />
        <div
          className={[styles.hotspot, debug ? styles.hotspotDebugRight : '']
            .filter(Boolean)
            .join(' ')}
          style={rightHotspotStyle}
          role="button"
          tabIndex={0}
          aria-label="Hit the toy from the right (it tilts left)"
          onClick={onRightHotspot}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              startPress(-1)
            }
          }}
        />
      </div>
      <div className={styles.footerBar}>
        <p className={styles.footerText}>Winning is so good</p>
        <button
          type="button"
          className={styles.footerCta}
          onClick={onComplete}
        >
          Love this job, next case!
        </button>
      </div>
    </div>
  )
}
