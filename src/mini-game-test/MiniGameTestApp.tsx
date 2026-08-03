import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  type ComponentType,
} from 'react'
import type { MiniGameTestProps } from './types'
import { useFrameMetrics } from './useFrameMetrics'
import styles from './MiniGameTestApp.module.css'

type TestVersion = 'current' | 'optimized'

const STAGE_WIDTH = 1147
const STAGE_HEIGHT = 796
const VERSION_URLS: Record<TestVersion, string> = {
  current: '?version=current',
  optimized: '?version=optimized',
}

function readVersion(): TestVersion {
  const requestedVersion = new URLSearchParams(window.location.search).get('version')
  return requestedVersion === 'current' ? 'current' : 'optimized'
}

const selectedVersion = readVersion()

const SelectedMiniGame = lazy(async (): Promise<{ default: ComponentType<MiniGameTestProps> }> => {
  if (selectedVersion === 'current') {
    const module = await import('./baseline/CurrentWhackAMole')
    return { default: module.CurrentWhackAMole }
  }

  const module = await import('./candidate/OptimizedWhackAMole')
  return { default: module.OptimizedWhackAMole }
})

function navigateToVersion(version: TestVersion) {
  if (version === selectedVersion) return
  const url = new URL(VERSION_URLS[version], window.location.href)
  url.searchParams.set('version', version)
  window.location.assign(url.href)
}

function FrameMetricsHud() {
  const metrics = useFrameMetrics()

  return (
    <output
      className={styles.metrics}
      data-testid="frame-metrics"
      aria-label="Live rendering performance"
    >
      <span><b>{metrics.fps || '—'}</b> FPS</span>
      <span><b>{metrics.longFrames}</b> long frames</span>
      <span><b>{metrics.worstFrameMs || '—'}</b> ms worst</span>
    </output>
  )
}

export function MiniGameTestApp() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const stage = stageRef.current
    if (!viewport || !stage) return

    const fitStage = () => {
      const bounds = viewport.getBoundingClientRect()
      const scale = Math.min(
        1,
        Math.max(0.1, (bounds.width - 24) / STAGE_WIDTH),
        Math.max(0.1, (bounds.height - 24) / STAGE_HEIGHT),
      )
      stage.style.setProperty('--test-stage-scale', String(scale))
    }

    fitStage()
    const observer = new ResizeObserver(fitStage)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const resetPage = useCallback(() => {
    window.location.reload()
  }, [])

  const handleClose = useCallback(() => {
    window.location.reload()
  }, [])

  return (
    <main
      className={styles.page}
      data-testid="mini-game-test"
      data-test-version={selectedVersion}
      data-native-cursors
    >
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <strong>Mini-game performance test</strong>
          <span className={styles.unlisted}>Unlisted preview</span>
        </div>

        <div className={styles.controls} aria-label="Choose mini-game version">
          <button
            type="button"
            className={selectedVersion === 'current' ? styles.activeVersion : styles.versionButton}
            data-version="current"
            aria-pressed={selectedVersion === 'current'}
            onClick={() => navigateToVersion('current')}
          >
            Current
          </button>
          <button
            type="button"
            className={selectedVersion === 'optimized' ? styles.activeVersion : styles.versionButton}
            data-version="optimized"
            aria-pressed={selectedVersion === 'optimized'}
            onClick={() => navigateToVersion('optimized')}
          >
            Optimized
          </button>
          <button
            type="button"
            className={styles.resetButton}
            data-testid="reset-test"
            onClick={resetPage}
          >
            Reset
          </button>
        </div>

        <FrameMetricsHud />
      </header>

      <section ref={viewportRef} className={styles.viewport} aria-label={`${selectedVersion} mini-game`}>
        <div ref={stageRef} className={styles.stage}>
          <Suspense fallback={<div className={styles.loading}>Loading {selectedVersion} version…</div>}>
            <SelectedMiniGame
              onClose={handleClose}
              draggable={selectedVersion === 'optimized'}
            />
          </Suspense>
        </div>
      </section>
    </main>
  )
}
