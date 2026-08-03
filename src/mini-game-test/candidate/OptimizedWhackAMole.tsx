import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { optimizedMiniGameAssets, prepareMiniGameAssets } from './assets'
import styles from './OptimizedWhackAMole.module.css'

const HOLE_COUNT = 3
const STARTING_LIVES = 3
const ROUND_DURATION_SECONDS = 30
const POINTS_PER_HIT = 10
const HIT_HOLD_MS = 262
const START_VISIBLE_MS = 672
const START_GAP_MS = 302
const SPEED_VISIBLE_STEP_MS = 72
const SPEED_GAP_STEP_MS = 34
const MIN_VISIBLE_MS = 250
const MIN_GAP_MS = 80
const HAMMER_STRIKE_MS = 360
const HAMMER_ANCHOR_X = 195
const HAMMER_ANCHOR_Y = 575
const HAMMER_HIT_Y_OFFSET = 310
const GRANDMA_HEAD_Y_RATIO = 0.25
const LIFE_FLICKER_MS = 620

type GameResult = { score: number; started: boolean }
type EndReason = 'lives' | 'time' | null
type AssetState = 'loading' | 'ready' | 'error'

type ActiveSpawn = {
  grandma: number
  hole: number
  id: number
}

type HammerStrike = {
  id: number
  x: number
  y: number
}

type DragState = {
  latestX: number
  latestY: number
  originX: number
  originY: number
  parentLeft: number
  parentTop: number
  renderedWidth: number
  scaleX: number
  scaleY: number
  startX: number
  startY: number
}

export type OptimizedWhackAMoleProps = {
  onClose: (result: GameResult) => void
  onContinue?: (result: GameResult) => void
  onMinimizeChange?: (minimized: boolean) => void
  minimized?: boolean
  draggable?: boolean
}

export function OptimizedWhackAMole({
  onClose,
  onContinue,
  onMinimizeChange,
  minimized: controlledMinimized,
  draggable = false,
}: OptimizedWhackAMoleProps) {
  const [assetState, setAssetState] = useState<AssetState>('loading')
  const [assetAttempt, setAssetAttempt] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [endReason, setEndReason] = useState<EndReason>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(ROUND_DURATION_SECONDS)
  const [started, setStarted] = useState(false)
  const [activeSpawn, setActiveSpawn] = useState<ActiveSpawn | null>(null)
  const [hammerStrike, setHammerStrike] = useState<HammerStrike | null>(null)
  const [hitSpawnId, setHitSpawnId] = useState<number | null>(null)
  const [lifeFlickerId, setLifeFlickerId] = useState(0)
  const [localMinimized, setLocalMinimized] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  const minimized = controlledMinimized ?? localMinimized
  const windowRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const showTimerRef = useRef<number | null>(null)
  const gapTimerRef = useRef<number | null>(null)
  const hitTimerRef = useRef<number | null>(null)
  const hammerTimerRef = useRef<number | null>(null)
  const lifeFlickerTimerRef = useRef<number | null>(null)
  const firstPaintFrameRef = useRef<number | null>(null)
  const secondPaintFrameRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const hitPendingRef = useRef(false)
  const activeSpawnIdRef = useRef<number | null>(null)
  const spawnIdRef = useRef(0)
  const hammerStrikeIdRef = useRef(0)
  const previousHoleRef = useRef<number | null>(null)
  const nextGrandmaRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speed = useMemo(() => {
    const step = Math.floor(score / 50)
    return {
      gap: Math.max(MIN_GAP_MS, START_GAP_MS - step * SPEED_GAP_STEP_MS),
      visible: Math.max(MIN_VISIBLE_MS, START_VISIBLE_MS - step * SPEED_VISIBLE_STEP_MS),
    }
  }, [score])
  const speedRef = useRef(speed)

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    let cancelled = false
    setAssetState('loading')

    void prepareMiniGameAssets().then(
      () => {
        if (!cancelled) setAssetState('ready')
      },
      () => {
        if (!cancelled) setAssetState('error')
      },
    )

    return () => {
      cancelled = true
    }
  }, [assetAttempt])

  useEffect(() => {
    const audio = new Audio(optimizedMiniGameAssets.ouch)
    audio.preload = 'auto'
    audioRef.current = audio

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const clearPaintFrames = useCallback(() => {
    if (firstPaintFrameRef.current !== null) {
      cancelAnimationFrame(firstPaintFrameRef.current)
      firstPaintFrameRef.current = null
    }
    if (secondPaintFrameRef.current !== null) {
      cancelAnimationFrame(secondPaintFrameRef.current)
      secondPaintFrameRef.current = null
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
    if (hitTimerRef.current !== null) {
      clearTimeout(hitTimerRef.current)
      hitTimerRef.current = null
    }
    if (hammerTimerRef.current !== null) {
      clearTimeout(hammerTimerRef.current)
      hammerTimerRef.current = null
    }
    if (lifeFlickerTimerRef.current !== null) {
      clearTimeout(lifeFlickerTimerRef.current)
      lifeFlickerTimerRef.current = null
    }
    clearPaintFrames()
  }, [clearPaintFrames])

  const endRound = useCallback((over: boolean, reason: EndReason = null) => {
    runningRef.current = false
    clearTimers()
    activeSpawnIdRef.current = null
    hitPendingRef.current = false
    previousHoleRef.current = null
    setActiveSpawn(null)
    setHammerStrike(null)
    setHitSpawnId(null)
    setLifeFlickerId(0)
    setRunning(false)
    setGameOver(over)
    setEndReason(reason)
  }, [clearTimers])

  const loseLife = useCallback(() => {
    setLives((previous) => Math.max(previous - 1, 0))
    setLifeFlickerId((previous) => previous + 1)

    if (lifeFlickerTimerRef.current !== null) {
      clearTimeout(lifeFlickerTimerRef.current)
    }

    lifeFlickerTimerRef.current = window.setTimeout(() => {
      setLifeFlickerId(0)
      lifeFlickerTimerRef.current = null
    }, LIFE_FLICKER_MS)
  }, [])

  const scheduleNextGrandma = useCallback(() => {
    if (!runningRef.current) return

    gapTimerRef.current = window.setTimeout(() => {
      gapTimerRef.current = null
      if (!runningRef.current) return

      const availableHoles = Array.from({ length: HOLE_COUNT }, (_, index) => index)
        .filter((index) => index !== previousHoleRef.current)
      const hole = availableHoles[Math.floor(Math.random() * availableHoles.length)]
      const grandma = nextGrandmaRef.current
      const id = ++spawnIdRef.current

      previousHoleRef.current = hole
      nextGrandmaRef.current = (nextGrandmaRef.current + 1) % optimizedMiniGameAssets.grandmas.length
      activeSpawnIdRef.current = id
      setActiveSpawn({ grandma, hole, id })
    }, speedRef.current.gap)
  }, [])

  // The visibility clock starts only after React has mounted the decoded
  // sprite and the browser has had two animation frames in which to paint it.
  useEffect(() => {
    const cancelVisibilityClock = () => {
      clearPaintFrames()
      if (showTimerRef.current !== null) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
    }

    if (!running || !activeSpawn || minimized) {
      cancelVisibilityClock()
      return
    }
    const spawnId = activeSpawn.id

    firstPaintFrameRef.current = requestAnimationFrame(() => {
      firstPaintFrameRef.current = null
      secondPaintFrameRef.current = requestAnimationFrame(() => {
        secondPaintFrameRef.current = null
        if (!runningRef.current || activeSpawnIdRef.current !== spawnId) return

        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = null
          if (!runningRef.current || activeSpawnIdRef.current !== spawnId) return

          activeSpawnIdRef.current = null
          setActiveSpawn(null)
          loseLife()
          scheduleNextGrandma()
        }, speedRef.current.visible)
      })
    })

    return cancelVisibilityClock
  }, [activeSpawn, clearPaintFrames, loseLife, minimized, running, scheduleNextGrandma])

  useEffect(() => {
    if (running && lives <= 0) endRound(true, 'lives')
  }, [endRound, lives, running])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (running && remainingSeconds <= 0) endRound(true, 'time')
  }, [endRound, remainingSeconds, running])

  const playHammerStrikeAt = useCallback((x: number, y: number) => {
    hammerStrikeIdRef.current += 1
    setHammerStrike({ x, y, id: hammerStrikeIdRef.current })

    if (hammerTimerRef.current !== null) clearTimeout(hammerTimerRef.current)
    hammerTimerRef.current = window.setTimeout(() => {
      setHammerStrike(null)
      hammerTimerRef.current = null
    }, HAMMER_STRIKE_MS)
  }, [])

  const playOuchSafely = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    try {
      audio.currentTime = 0
      const playback = audio.play() as Promise<void> | undefined
      if (playback && typeof playback.catch === 'function') {
        void playback.catch(() => undefined)
      }
    } catch {
      // Audio is an optional effect and cannot interrupt the spawn loop.
    }
  }, [])

  const animateHitSafely = useCallback((grandma: HTMLImageElement) => {
    if (typeof grandma.animate !== 'function') return

    try {
      grandma.animate(
        [
          { opacity: 1, transform: 'translate(-50%, 0) scale(1, 1)' },
          { opacity: 1, transform: 'translate(-50%, -7px) scale(0.98, 1.03)', offset: 0.16 },
          { opacity: 1, transform: 'translate(-54%, 9px) scale(1.18, 0.68)', offset: 0.42 },
          { opacity: 0.72, transform: 'translate(-46%, 18px) scale(1.27, 0.3)', offset: 0.72 },
          { opacity: 0, transform: 'translate(-50%, 24px) scale(1.32, 0.14)' },
        ],
        {
          duration: HIT_HOLD_MS,
          easing: 'cubic-bezier(0.4, 0, 0.8, 1)',
          fill: 'forwards',
        },
      )
    } catch {
      // Web Animations is optional; the guaranteed cleanup is already queued.
    }
  }, [])

  const hammerPositionFor = useCallback((
    hole: HTMLButtonElement,
    targetY: number,
  ): { x: number; y: number } => {
    const holes = hole.parentElement
    return {
      x: (holes?.offsetLeft ?? 0) + hole.offsetLeft + hole.offsetWidth / 2,
      y: (holes?.offsetTop ?? 0) + hole.offsetTop + targetY + HAMMER_HIT_Y_OFFSET,
    }
  }, [])

  const handleHoleClick = (holeIndex: number, event: MouseEvent<HTMLButtonElement>) => {
    if (!runningRef.current || hitPendingRef.current) return

    const hole = event.currentTarget

    // Empty strikes pause the pending gap so a sprite cannot appear beneath
    // the hammer, then restart the ordinary schedule after the one-pass asset.
    if (!activeSpawn) {
      hitPendingRef.current = true
      if (gapTimerRef.current !== null) {
        clearTimeout(gapTimerRef.current)
        gapTimerRef.current = null
      }

      const point = hammerPositionFor(hole, hole.offsetHeight / 2)
      playHammerStrikeAt(point.x, point.y)
      hitTimerRef.current = window.setTimeout(() => {
        hitTimerRef.current = null
        if (!runningRef.current) return
        hitPendingRef.current = false
        scheduleNextGrandma()
      }, HAMMER_STRIKE_MS)
      return
    }

    if (activeSpawn.hole !== holeIndex) return
    const clickedElement = event.target as HTMLElement
    const grandma = clickedElement.closest<HTMLImageElement>('[data-whack-grandma]')
    if (!grandma) return

    hitPendingRef.current = true
    clearPaintFrames()
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }

    const point = hammerPositionFor(
      hole,
      grandma.offsetTop + grandma.offsetHeight * GRANDMA_HEAD_Y_RATIO,
    )
    playHammerStrikeAt(point.x, point.y)
    setScore((currentScore) => currentScore + POINTS_PER_HIT)
    setHitSpawnId(activeSpawn.id)

    // Queue the state recovery before optional browser effects. Even if
    // play() or animate() is unsupported or throws, the next spawn proceeds.
    hitTimerRef.current = window.setTimeout(() => {
      hitTimerRef.current = null
      if (!runningRef.current) return
      activeSpawnIdRef.current = null
      setActiveSpawn(null)
      setHitSpawnId(null)
      hitPendingRef.current = false
      scheduleNextGrandma()
    }, HIT_HOLD_MS)

    playOuchSafely()
    animateHitSafely(grandma)
  }

  const handleStart = () => {
    if (assetState !== 'ready') return

    clearTimers()
    setScore(0)
    setLives(STARTING_LIVES)
    setRemainingSeconds(ROUND_DURATION_SECONDS)
    setGameOver(false)
    setEndReason(null)
    setActiveSpawn(null)
    setHammerStrike(null)
    setHitSpawnId(null)
    setLifeFlickerId(0)
    hitPendingRef.current = false
    activeSpawnIdRef.current = null
    previousHoleRef.current = null
    nextGrandmaRef.current = 0
    setRunning(true)
    setStarted(true)
    runningRef.current = true
    scheduleNextGrandma()
  }

  const handleMinimize = () => {
    const next = !minimized
    if (controlledMinimized === undefined) setLocalMinimized(next)
    onMinimizeChange?.(next)
  }

  const applyPendingDragPosition = useCallback(() => {
    dragFrameRef.current = null
    const element = windowRef.current
    const drag = dragRef.current
    if (!element || !drag) return

    element.style.left = `${drag.latestX}px`
    element.style.top = `${drag.latestY}px`
    element.style.transform = 'none'
  }, [])

  const handleTitleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!draggable || (event.target as HTMLElement).closest('button')) return
    const element = windowRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const parent = element.offsetParent as HTMLElement | null
    const parentRect = parent?.getBoundingClientRect()
    const parentWidth = parent?.offsetWidth ?? window.innerWidth
    const parentHeight = parent?.offsetHeight ?? window.innerHeight
    const measuredScaleX = parentRect && parentWidth > 0 ? parentRect.width / parentWidth : 1
    const measuredScaleY = parentRect && parentHeight > 0 ? parentRect.height / parentHeight : 1
    const scaleX = measuredScaleX > 0 ? measuredScaleX : 1
    const scaleY = measuredScaleY > 0 ? measuredScaleY : 1
    const parentLeft = parentRect?.left ?? 0
    const parentTop = parentRect?.top ?? 0

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      latestX: (rect.left - parentLeft) / scaleX,
      latestY: (rect.top - parentTop) / scaleY,
      parentLeft,
      parentTop,
      renderedWidth: rect.width,
      scaleX,
      scaleY,
    }
    document.body.classList.add(styles.draggingCursor)
    event.preventDefault()
  }

  useEffect(() => {
    if (!draggable) return

    const handleMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const viewportX = Math.max(
        -drag.renderedWidth + 200,
        Math.min(
          window.innerWidth - Math.min(drag.renderedWidth, 200),
          drag.originX + event.clientX - drag.startX,
        ),
      )
      const viewportY = Math.max(
        0,
        Math.min(window.innerHeight - 50, drag.originY + event.clientY - drag.startY),
      )
      drag.latestX = (viewportX - drag.parentLeft) / drag.scaleX
      drag.latestY = (viewportY - drag.parentTop) / drag.scaleY

      if (dragFrameRef.current === null) {
        dragFrameRef.current = requestAnimationFrame(applyPendingDragPosition)
      }

      const selection = getSelection()
      if (selection && !selection.isCollapsed) selection.removeAllRanges()
    }

    const handleUp = () => {
      const drag = dragRef.current
      if (!drag) return
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
        applyPendingDragPosition()
      }
      setPosition({ x: drag.latestX, y: drag.latestY })
      dragRef.current = null
      document.body.classList.remove(styles.draggingCursor)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
      dragRef.current = null
      document.body.classList.remove(styles.draggingCursor)
    }
  }, [applyPendingDragPosition, draggable])

  useEffect(() => {
    return () => {
      runningRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  const positionStyle: CSSProperties = !draggable
    ? {}
    : position === null
      ? { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
      : { position: 'absolute', left: position.x, top: position.y, transform: 'none' }

  const showStartScreen = !running && !gameOver

  return (
    <div
      ref={windowRef}
      className={[
        styles.window,
        draggable ? styles.draggable : '',
        minimized ? styles.windowMinimized : '',
      ].filter(Boolean).join(' ')}
      style={positionStyle}
      data-testid="optimized-mini-game"
      data-mini-game-version="optimized"
      data-assets-state={assetState}
    >
      <div className={styles.titleBar} onMouseDown={handleTitleMouseDown}>
        <span className={styles.title}>Mini Game</span>
        <div className={styles.windowActions}>
          <button
            type="button"
            className={styles.minimizeIcon}
            onClick={handleMinimize}
            aria-label={minimized ? 'Restore' : 'Minimize'}
          />
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => onClose({ score, started })}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {!minimized && (
        <div className={styles.board} data-whack-board>
          <img
            className={styles.background}
            src={optimizedMiniGameAssets.background}
            alt=""
            draggable={false}
          />

          <div className={styles.holes} aria-label="Whack a mole holes">
            {Array.from({ length: HOLE_COUNT }).map((_, holeIndex) => {
              const isActive = activeSpawn?.hole === holeIndex
              const grandma = optimizedMiniGameAssets.grandmas[activeSpawn?.grandma ?? 0]
              const isHit = isActive && hitSpawnId === activeSpawn?.id

              return (
                <button
                  key={holeIndex}
                  type="button"
                  className={styles.hole}
                  onClick={(event) => handleHoleClick(holeIndex, event)}
                  aria-label={`Hole ${holeIndex + 1}`}
                >
                  {isActive && (
                    <img
                      className={styles.grandma}
                      src={grandma.url}
                      alt={grandma.name}
                      data-whack-grandma
                      data-spawn-id={activeSpawn.id}
                      draggable={false}
                    />
                  )}
                  {isHit && <span key={activeSpawn.id} className={styles.impactFlash} aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          <div className={gameOver ? styles.scoreBarEnd : styles.scoreBar}>
            {gameOver ? (
              <p className={styles.endMessage}>
                {endReason === 'time' ? "Time's up!" : 'Loser! The grandmas win'}
              </p>
            ) : (
              <>
                <p className={styles.score} data-testid="score">Score: {score}</p>
                <p
                  className={styles.timer}
                  data-testid="remaining-time"
                  aria-label={`${remainingSeconds} seconds remaining`}
                >
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
                  {String(remainingSeconds % 60).padStart(2, '0')}
                </p>
                <div className={styles.lives} aria-label={`${lives} lives left`}>
                  {Array.from({ length: STARTING_LIVES }).map((_, index) => (
                    <img
                      key={index}
                      className={index < lives && lifeFlickerId > 0 ? styles.lifeFlicker : styles.life}
                      src={index < lives
                        ? optimizedMiniGameAssets.lifeFull
                        : optimizedMiniGameAssets.lifeEmpty}
                      alt=""
                      draggable={false}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {(showStartScreen || gameOver) && (
            <div className={styles.overlay}>
              {showStartScreen && (
                <h2 className={styles.startTitle} data-text="Whack a Grandma">
                  Whack a Grandma
                </h2>
              )}

              {assetState === 'error' && showStartScreen ? (
                <>
                  <p className={styles.loadError} role="alert">Artwork failed to load.</p>
                  <button
                    type="button"
                    className={styles.startBtn}
                    onClick={() => setAssetAttempt((attempt) => attempt + 1)}
                  >
                    Retry
                  </button>
                </>
              ) : gameOver && onContinue ? (
                <div className={styles.endActions}>
                  <button type="button" className={styles.startBtn} onClick={handleStart}>
                    Try again
                  </button>
                  <button
                    type="button"
                    className={styles.continueBtn}
                    onClick={() => onContinue({ score, started })}
                  >
                    Back to the cases
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.startBtn}
                  data-testid="start-game"
                  onClick={handleStart}
                  disabled={assetState !== 'ready'}
                >
                  {assetState === 'loading' ? 'Loading…' : gameOver ? 'Play again' : 'Start'}
                </button>
              )}
            </div>
          )}

          {running && hammerStrike && (
            <img
              key={hammerStrike.id}
              className={styles.hammer}
              src={optimizedMiniGameAssets.hammer}
              alt=""
              draggable={false}
              style={{
                transform: `translate(${hammerStrike.x - HAMMER_ANCHOR_X}px, ${hammerStrike.y - HAMMER_ANCHOR_Y}px)`,
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
