import { useEffect, useRef } from 'react'

/**
 * The game is designed at 1920×1080. This hook scales that canvas
 * to fit any screen size while keeping the authored layout intact.
 *
 * Attach the returned ref to a fixed 1920×1080 container.
 */
const GAME_W = 1920
const GAME_H = 1080

export function useGameScale() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function scale() {
      const el = ref.current
      if (!el) return
      const sx = window.innerWidth  / GAME_W
      const sy = window.innerHeight / GAME_H
      const s  = Math.min(sx, sy)                 // fit inside, never crop
      const ox = (window.innerWidth  - GAME_W * s) / 2
      const oy = (window.innerHeight - GAME_H * s) / 2
      el.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`
      el.style.setProperty('--game-scale', String(s))
      el.style.setProperty('--game-offset-x', `${ox}px`)
      el.style.setProperty('--game-offset-y', `${oy}px`)
    }
    scale()
    window.addEventListener('resize', scale)
    return () => window.removeEventListener('resize', scale)
  }, [])

  return ref
}
