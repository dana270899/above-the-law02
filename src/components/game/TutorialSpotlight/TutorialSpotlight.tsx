import { useLayoutEffect, useRef, useState } from 'react'
import styles from './TutorialSpotlight.module.css'

/* ════════════════════════════════════════════════════
   TutorialSpotlight

   Turns the desktop into real black-and-white via
   `backdrop-filter: grayscale(1)` while leaving the
   chosen DOM element in its original colors.

   Implementation note — why four strips, not a masked
   overlay: combining `mask-image` with `backdrop-filter`
   is unreliable across browsers (the filter often
   ignores the mask). Instead we render four strips
   (top, bottom, left, right) around the target rect.
   Each strip applies the grayscale filter; the target
   area in the middle has no strip over it and stays in
   color. When no target is set, a single full-canvas
   strip is rendered, turning the whole desktop B&W.

   The component sits in Desktop's `tutorialOverlay`
   slot — rendered after the taskbar — so the filter
   reaches every desktop element (icons, logo, windows,
   taskbar). The boss message has a higher z-index, so
   it ends up painted on top of these strips and stays
   in color.

   `targetId` matches the `data-spot="<id>"` attribute set
   on the highlightable DOM nodes (see lib/spotlightTargets).
   ════════════════════════════════════════════════════ */

export type TutorialSpotlightProps = {
  /** Spotlight target — value of `data-spot` on the element to highlight. */
  targetId?: string
  /** Pixels of breathing room around the target rect. Defaults to 0 so
   *  the colored area matches the target's exact bounds — no perceived
   *  highlight box around it. */
  padding?: number
}

type Rect = { x: number; y: number; w: number; h: number }

export function TutorialSpotlight({ targetId, padding = 0 }: TutorialSpotlightProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // Recompute the wrapper size + target rect on mount, on every animation
  // frame for a short burst after mount (animations / images can shift
  // layout briefly), and on resize. Cheap because we only read layout.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    let raf = 0
    const stopAt = performance.now() + 1500 // settle window

    const measure = () => {
      const wRect = wrapper.getBoundingClientRect()
      // Wrapper untransformed pixels (the canvas is CSS-scaled to fit the
      // viewport — we work in untransformed canvas-pixel space).
      const scale = wRect.width / wrapper.offsetWidth || 1
      setSize({ w: wrapper.offsetWidth, h: wrapper.offsetHeight })

      if (!targetId) {
        setRect(null)
        return
      }
      const target = document.querySelector(`[data-spot="${CSS.escape(targetId)}"]`)
      if (!(target instanceof Element)) {
        setRect(null)
        return
      }
      const tRect = target.getBoundingClientRect()
      setRect({
        x: (tRect.left - wRect.left) / scale - padding,
        y: (tRect.top - wRect.top) / scale - padding,
        w: tRect.width / scale + padding * 2,
        h: tRect.height / scale + padding * 2,
      })
    }

    const tick = () => {
      measure()
      if (performance.now() < stopAt) {
        raf = requestAnimationFrame(tick)
      }
    }
    tick()

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [targetId, padding])

  // Layout the four grayscale strips around the target rect.
  // Clamp the rect to the wrapper so a partially off-canvas target
  // doesn't produce negative strip sizes.
  const stripPositions = (() => {
    if (size.w === 0 || size.h === 0) return null
    if (!rect) {
      // No target — one full-canvas strip turns the whole desktop B&W.
      return [{ top: 0, left: 0, width: size.w, height: size.h }]
    }
    const x = Math.max(0, Math.min(size.w, rect.x))
    const y = Math.max(0, Math.min(size.h, rect.y))
    const r = Math.max(0, Math.min(size.w, rect.x + rect.w))
    const b = Math.max(0, Math.min(size.h, rect.y + rect.h))
    return [
      // Top strip: full width, above the target.
      { top: 0, left: 0, width: size.w, height: y },
      // Bottom strip: full width, below the target.
      { top: b, left: 0, width: size.w, height: Math.max(0, size.h - b) },
      // Left strip: between top and bottom, left of the target.
      { top: y, left: 0, width: x, height: Math.max(0, b - y) },
      // Right strip: between top and bottom, right of the target.
      { top: y, left: r, width: Math.max(0, size.w - r), height: Math.max(0, b - y) },
    ]
  })()

  return (
    <div ref={wrapperRef} className={styles.wrap} aria-hidden>
      {stripPositions?.map((s, i) =>
        s.width > 0 && s.height > 0 ? (
          <div
            key={i}
            className={styles.bw}
            style={{
              top: s.top,
              left: s.left,
              width: s.width,
              height: s.height,
            }}
          />
        ) : null,
      )}
    </div>
  )
}
