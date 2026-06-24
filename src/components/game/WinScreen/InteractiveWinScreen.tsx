import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { WinVariant } from '@/lib/winScreenImage'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './InteractiveWinScreen.module.css'

/* ═══════════════════════════════════════════════
   INTERACTIVE WIN SCREEN — base component

   Renders a win-screen background image full-width
   and overlays a hotspot the player either clicks
   or drags. After the interaction fires, the optional
   reaction media (gif or video) renders on top of
   the background.

   Each concrete variant (Graffiti, PunchingDummy,
   KippahCutting) is a thin wrapper that pins the
   variant id and supplies its own hotspot area and
   media path. Look at Graffiti.tsx for the simplest
   working example.
════════════════════════════════════════════════ */

/** Hotspot rectangle as percentages of the rendered background image
 *  (0-100). Percent-based coordinates keep the hotspot aligned across
 *  viewport sizes — the background fills 100% width and the wrapper
 *  scales with it. */
export interface HotspotArea {
  x: number
  y: number
  width: number
  height: number
}

export interface InteractionConfig {
  kind: 'click' | 'drag'
  area: HotspotArea
  /** Drag-only: minimum pointer travel (CSS px) before the drag counts
   *  as completed. Defaults to 60. */
  dragThreshold?: number
}

export type MediaKind = 'image' | 'video'

export interface InteractiveWinScreenProps {
  /** Win-screen variant id — resolved through `lib/winScreens.ts` for
   *  the bundled background image and the per-variant localStorage
   *  override the editor's Components tab manages. */
  variant: WinVariant
  /** What the player has to do — click a region, or drag inside it. */
  interaction: InteractionConfig
  /** GIF / WebM / MP4 played after the interaction succeeds. Optional
   *  while the variant is still being authored. */
  mediaSrc?: string
  /** Defaults to `'image'`. Pass `'video'` for a `<video>` element with
   *  autoplay. Media completion does not advance the graph; exiting is
   *  owned by the win window controls. */
  mediaKind?: MediaKind
  /** Kept for compatibility with windowed variants; not fired by the
   *  hotspot/media interaction itself. */
  onComplete?: () => void
  /** Outline the hotspot — useful while tuning coordinates. Off in prod. */
  debug?: boolean
  /** Forwarded onto the outer wrapper. */
  className?: string
  /** Explicit background image override — wins over `variant` and any
   *  localStorage override. Used by legacy per-node uploads stored as
   *  data URLs on `data.winImageCustom`. */
  src?: string
  /** IndexedDB blob id for a per-node uploaded background image. Wins
   *  over `src`, `variant`, and the localStorage override. */
  blobId?: string
}

export function InteractiveWinScreen({
  variant,
  interaction,
  mediaSrc,
  mediaKind = 'image',
  debug = false,
  className,
  src: srcOverride,
  blobId,
}: InteractiveWinScreenProps) {
  const { src: bgSrc, label, handleError: handleBgError } = useWinScreenBackground({
    variant,
    src: srcOverride,
    blobId,
  })

  // Phase machine: 'idle' shows the hotspot; 'reacting' shows the
  // media overlay. Advancing the graph is owned by the window buttons,
  // never by the mini-interaction itself.
  const [phase, setPhase] = useState<'idle' | 'reacting'>('idle')
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const completedRef = useRef(false)

  function triggerReaction() {
    if (phase !== 'idle') return
    setPhase('reacting')
  }

  function handleMediaEnd() {
    if (completedRef.current) return
    completedRef.current = true
  }

  function onHotspotClick(e: React.MouseEvent) {
    if (interaction.kind !== 'click') return
    // Don't let the click bubble — the win-stop wrapper has its own
    // click-anywhere-to-advance handler, and hitting the hotspot should
    // play the reaction, not skip past it.
    e.stopPropagation()
    triggerReaction()
  }

  function onHotspotMouseDown(e: React.MouseEvent) {
    if (interaction.kind !== 'drag') return
    e.stopPropagation()
    dragRef.current = { x: e.clientX, y: e.clientY }
  }

  useEffect(() => {
    if (interaction.kind !== 'drag') return
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      const threshold = interaction.dragThreshold ?? 60
      if (Math.hypot(dx, dy) >= threshold) {
        dragRef.current = null
        triggerReaction()
      }
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [interaction.kind, interaction.dragThreshold])

  const hotspotStyle: CSSProperties = {
    left: `${interaction.area.x}%`,
    top: `${interaction.area.y}%`,
    width: `${interaction.area.width}%`,
    height: `${interaction.area.height}%`,
  }

  return (
    <div
      className={[styles.screen, className].filter(Boolean).join(' ')}
      data-node={`win-${variant}`}
    >
      <img
        className={styles.scene}
        src={bgSrc}
        alt={label}
        draggable={false}
        onError={handleBgError}
      />
      {phase === 'idle' && (
        <div
          className={[
            styles.hotspot,
            interaction.kind === 'drag' ? styles.hotspotDrag : styles.hotspotClick,
            debug ? styles.hotspotDebug : '',
          ].filter(Boolean).join(' ')}
          style={hotspotStyle}
          role="button"
          tabIndex={0}
          aria-label={`Interact with the ${label} win screen`}
          onClick={onHotspotClick}
          onMouseDown={onHotspotMouseDown}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              triggerReaction()
            }
          }}
        />
      )}
      {phase === 'reacting' && mediaSrc && (
        mediaKind === 'video' ? (
          <video
            className={styles.media}
            src={mediaSrc}
            autoPlay
            playsInline
            onEnded={handleMediaEnd}
          />
        ) : (
          <img
            className={styles.media}
            src={mediaSrc}
            alt=""
          />
        )
      )}
    </div>
  )
}
