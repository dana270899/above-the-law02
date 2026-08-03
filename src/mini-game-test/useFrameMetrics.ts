import { useEffect, useRef, useState } from 'react'

export type FrameMetrics = {
  fps: number
  longFrames: number
  worstFrameMs: number
}

const SAMPLE_WINDOW_MS = 750
const LONG_FRAME_MS = 50

const INITIAL_METRICS: FrameMetrics = {
  fps: 0,
  longFrames: 0,
  worstFrameMs: 0,
}

/** Measures the rendered page rather than either implementation's own state. */
export function useFrameMetrics(): FrameMetrics {
  const [metrics, setMetrics] = useState<FrameMetrics>(INITIAL_METRICS)
  const totalsRef = useRef({ longFrames: 0, worstFrameMs: 0 })

  useEffect(() => {
    let animationFrame = 0
    let lastFrameAt: number | null = null
    let sampleStartedAt: number | null = null
    let sampleFrames = 0

    const sample = (now: number) => {
      if (lastFrameAt !== null) {
        const frameMs = now - lastFrameAt
        if (frameMs > LONG_FRAME_MS) totalsRef.current.longFrames += 1
        totalsRef.current.worstFrameMs = Math.max(totalsRef.current.worstFrameMs, frameMs)
      }

      lastFrameAt = now
      sampleStartedAt ??= now
      sampleFrames += 1

      const elapsed = now - sampleStartedAt
      if (elapsed >= SAMPLE_WINDOW_MS) {
        const totals = totalsRef.current
        setMetrics({
          fps: Math.round((sampleFrames * 1000) / elapsed),
          longFrames: totals.longFrames,
          worstFrameMs: Math.round(totals.worstFrameMs),
        })
        sampleStartedAt = now
        sampleFrames = 0
      }

      animationFrame = window.requestAnimationFrame(sample)
    }

    animationFrame = window.requestAnimationFrame(sample)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  return metrics
}
