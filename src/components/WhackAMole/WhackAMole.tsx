import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { assetUrl } from '@/lib/paths'
import { startDragCursor, stopDragCursor } from '@/lib/dragCursor'
import styles from './WhackAMole.module.css'

const HOLE_COUNT = 3
const STARTING_LIVES = 3
const ROUND_DURATION_SECONDS = 30
const POINTS_PER_HIT = 10
const HIT_HOLD_MS = 262
const START_VISIBLE_MS = 672
const START_GAP_MS = 302
const SPEED_VISIBLE_STEP_MS = 72
const SPEED_GAP_STEP_MS = 34
const MIN_VISIBLE_MS = 109
const MIN_GAP_MS = 30
const HAMMER_STRIKE_MS = 372
const HAMMER_IMPACT_MS = 18
const HAMMER_ANCHOR_X = 195
const HAMMER_ANCHOR_Y = 575
const HAMMER_HIT_Y_OFFSET = 310
const GRANDMA_HEAD_Y_RATIO = 0.25
const LIFE_FLICKER_MS = 620

type GrandmaSprite = {
  default: string
  name: string
}

const GRANDMAS: GrandmaSprite[] = [
  {
    name: 'Lech grandma',
    default: assetUrl('/images/mini-game/Grandma01_default.svg'),
  },
  {
    name: 'Democracy grandma',
    default: assetUrl('/images/mini-game/Grandma02_default.svg'),
  },
  {
    name: 'Peace grandma',
    default: assetUrl('/images/mini-game/Grandma03_default.svg'),
  },
]

const LIFE_FULL = assetUrl('/images/mini-game/Life-full.svg')
const LIFE_EMPTY = assetUrl('/images/mini-game/Life-empty.svg')
const HAMMER = assetUrl('/images/mini-game/Hammer_animated_fast.gif')
const BACKGROUND = assetUrl('/images/mini-game/game_bg.svg')
const OUCH_SOUND = assetUrl('/sounds/Ouch01.mp3')

export type WhackAMoleProps = {
  onClose: (result: { score: number; started: boolean }) => void
  onContinue?: (result: { score: number; started: boolean }) => void
  onMinimizeChange?: (minimized: boolean) => void
  minimized?: boolean
  draggable?: boolean
}

export function WhackAMole({ onClose, onContinue, onMinimizeChange, minimized: controlledMinimized, draggable = false }: WhackAMoleProps) {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [endReason, setEndReason] = useState<'lives' | 'time' | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(ROUND_DURATION_SECONDS)
  const [started, setStarted] = useState(false)
  const [activeHole, setActiveHole] = useState<number | null>(null)
  const [activeGrandma, setActiveGrandma] = useState(0)
  const [hammerStrike, setHammerStrike] = useState<{ x: number; y: number; id: number } | null>(null)
  const [lifeFlickerId, setLifeFlickerId] = useState(0)
  const [localMinimized, setLocalMinimized] = useState(false)
  const minimized = controlledMinimized ?? localMinimized
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  const windowRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const showTimerRef = useRef<number | null>(null)
  const gapTimerRef = useRef<number | null>(null)
  const hitTimerRef = useRef<number | null>(null)
  const hammerTimerRef = useRef<number | null>(null)
  const lifeFlickerTimerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const hitPendingRef = useRef(false)
  const hammerStrikeIdRef = useRef(0)
  const previousHoleRef = useRef<number | null>(null)
  const nextGrandmaRef = useRef(0)

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
  }, [])

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

  const endRound = useCallback(
    (over: boolean, reason: 'lives' | 'time' | null = null) => {
      runningRef.current = false
      clearTimers()
      setActiveHole(null)
      setHammerStrike(null)
      setLifeFlickerId(0)
      hitPendingRef.current = false
      previousHoleRef.current = null
      setRunning(false)
      setGameOver(over)
      setEndReason(reason)
    },
    [clearTimers],
  )

  const loseLife = useCallback(() => {
    setLives((prev) => Math.max(prev - 1, 0))
    setLifeFlickerId((prev) => prev + 1)

    if (lifeFlickerTimerRef.current !== null) {
      clearTimeout(lifeFlickerTimerRef.current)
    }

    lifeFlickerTimerRef.current = window.setTimeout(() => {
      setLifeFlickerId(0)
      lifeFlickerTimerRef.current = null
    }, LIFE_FLICKER_MS)
  }, [])

  useEffect(() => {
    if (running && lives <= 0) endRound(true, 'lives')
  }, [running, lives, endRound])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (running && remainingSeconds <= 0) endRound(true, 'time')
  }, [running, remainingSeconds, endRound])

  const scheduleNextMole = useCallback(() => {
    if (!runningRef.current) return
    gapTimerRef.current = window.setTimeout(() => {
      if (!runningRef.current) return
      const availableHoles = Array.from({ length: HOLE_COUNT }, (_, i) => i).filter(
        (i) => i !== previousHoleRef.current,
      )
      const holeIdx = availableHoles[Math.floor(Math.random() * availableHoles.length)]
      const grandmaIdx = nextGrandmaRef.current
      nextGrandmaRef.current = (nextGrandmaRef.current + 1) % GRANDMAS.length
      previousHoleRef.current = holeIdx
      setActiveHole(holeIdx)
      setActiveGrandma(grandmaIdx)
      showTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        setActiveHole(null)
        loseLife()
        scheduleNextMole()
      }, speedRef.current.visible)
    }, speedRef.current.gap)
  }, [loseLife])

  const handleStart = () => {
    clearTimers()
    setScore(0)
    setLives(STARTING_LIVES)
    setRemainingSeconds(ROUND_DURATION_SECONDS)
    setGameOver(false)
    setEndReason(null)
    setActiveHole(null)
    setHammerStrike(null)
    setLifeFlickerId(0)
    hitPendingRef.current = false
    previousHoleRef.current = null
    nextGrandmaRef.current = 0
    setRunning(true)
    setStarted(true)
    runningRef.current = true
    scheduleNextMole()
  }

  const handleHoleClick = (i: number, event: MouseEvent<HTMLButtonElement>) => {
    if (!running) return
    if (hitPendingRef.current) return

    // Let the hammer strike an empty hole during the gap between grandmas.
    // Cancel the pending spawn first so a grandma cannot appear underneath
    // the hammer, then resume the normal spawn schedule once it finishes.
    if (activeHole === null) {
      hitPendingRef.current = true
      if (gapTimerRef.current !== null) {
        clearTimeout(gapTimerRef.current)
        gapTimerRef.current = null
      }

      const board = event.currentTarget.closest<HTMLElement>('[data-whack-board]')
      const holes = event.currentTarget.parentElement
      if (board) {
        const hole = event.currentTarget
        playHammerStrikeAt(
          (holes?.offsetLeft ?? 0) + hole.offsetLeft + hole.offsetWidth / 2,
          (holes?.offsetTop ?? 0) + hole.offsetTop + hole.offsetHeight / 2
            + HAMMER_HIT_Y_OFFSET,
        )
      }

      if (hitTimerRef.current !== null) clearTimeout(hitTimerRef.current)
      hitTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        hitPendingRef.current = false
        hitTimerRef.current = null
        scheduleNextMole()
      }, HAMMER_STRIKE_MS)
      return
    }

    if (activeHole === i) {
      const clickedElement = event.target as HTMLElement
      const grandma = clickedElement.closest<HTMLImageElement>('[data-whack-grandma]')
      if (!grandma) return

      hitPendingRef.current = true
      if (showTimerRef.current !== null) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }

      const board = event.currentTarget.closest<HTMLElement>('[data-whack-board]')
      const holes = event.currentTarget.parentElement
      if (board) {
        const hole = event.currentTarget
        playHammerStrikeAt(
          (holes?.offsetLeft ?? 0) + hole.offsetLeft + hole.offsetWidth / 2,
          (holes?.offsetTop ?? 0) + hole.offsetTop + grandma.offsetTop
            + grandma.offsetHeight * GRANDMA_HEAD_Y_RATIO
            + HAMMER_HIT_Y_OFFSET,
        )
      }

      setScore((s) => s + POINTS_PER_HIT)
      const audio = new Audio(OUCH_SOUND)
      if (hitTimerRef.current !== null) {
        clearTimeout(hitTimerRef.current)
      }
      hitTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        audio.play().catch(() => { /* autoplay blocked — ignore */ })
        grandma.animate(
          [
            {
              opacity: 1,
              filter: 'brightness(1) saturate(1)',
              transform: 'translate(-50%, 0) scale(1, 1)',
            },
            {
              opacity: 1,
              filter: 'brightness(1) saturate(1)',
              transform: 'translate(-50%, -7px) scale(0.98, 1.03)',
              offset: 0.12,
            },
            {
              opacity: 1,
              filter: 'brightness(1.28) saturate(1.25)',
              transform: 'translate(-54%, 9px) scale(1.18, 0.68)',
              offset: 0.34,
            },
            {
              opacity: 1,
              filter: 'brightness(1.08) saturate(1.1)',
              transform: 'translate(-46%, 18px) scale(1.27, 0.3)',
              offset: 0.62,
            },
            {
              opacity: 0,
              filter: 'brightness(1) saturate(1)',
              transform: 'translate(-50%, 24px) scale(1.32, 0.14)',
            },
          ],
          { duration: HIT_HOLD_MS, easing: 'cubic-bezier(0.4, 0, 0.8, 1)', fill: 'forwards' },
        )
        hitTimerRef.current = window.setTimeout(() => {
          if (!runningRef.current) return
          setActiveHole(null)
          hitPendingRef.current = false
          scheduleNextMole()
        }, HIT_HOLD_MS)
      }, HAMMER_IMPACT_MS)
    }
  }

  const playHammerStrikeAt = (x: number, y: number) => {
    hammerStrikeIdRef.current += 1
    setHammerStrike({
      x,
      y,
      id: hammerStrikeIdRef.current,
    })

    if (hammerTimerRef.current !== null) {
      clearTimeout(hammerTimerRef.current)
    }

    hammerTimerRef.current = window.setTimeout(() => {
      setHammerStrike(null)
      hammerTimerRef.current = null
    }, HAMMER_STRIKE_MS)
  }

  useEffect(() => {
    return () => {
      runningRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  const showStartScreen = !running && !gameOver

  const handleMinimize = () => {
    const next = !minimized
    if (controlledMinimized === undefined) setLocalMinimized(next)
    onMinimizeChange?.(next)
  }

  const handleTitleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!draggable || (event.target as HTMLElement).closest('button')) return
    const element = windowRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    }
    startDragCursor()
    event.preventDefault()
  }

  useEffect(() => {
    if (!draggable) return
    const handleMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const element = windowRef.current
      const width = element?.offsetWidth ?? 0
      const nextX = drag.originX + event.clientX - drag.startX
      const nextY = drag.originY + event.clientY - drag.startY
      setPosition({
        x: Math.max(-width + 200, Math.min(window.innerWidth - Math.min(width, 200), nextX)),
        y: Math.max(0, Math.min(window.innerHeight - 50, nextY)),
      })
      const selection = getSelection()
      if (selection && !selection.isCollapsed) selection.removeAllRanges()
    }
    const handleUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      stopDragCursor()
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (dragRef.current) {
        dragRef.current = null
        stopDragCursor()
      }
    }
  }, [draggable])

  const positionStyle: CSSProperties = !draggable
    ? {}
    : position === null
      ? { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
      : { position: 'absolute', left: position.x, top: position.y, transform: 'none' }

  return (
    <div
      ref={windowRef}
      className={[
        running ? styles.windowRunning : styles.window,
        draggable ? styles.draggable : '',
        minimized ? styles.windowMinimized : '',
      ].filter(Boolean).join(' ')}
      style={positionStyle}
    >
      <div className={styles.titleBar} onMouseDown={handleTitleMouseDown}>
        <span className={styles.title}>Mini Game</span>
        <div className={styles.windowActions}>
          <span className={styles.expandIcon} aria-hidden="true" />
          <button
            type="button"
            className={styles.minimizeIcon}
            onClick={handleMinimize}
            aria-label={minimized ? 'Restore' : 'Minimize'}
          />
          <button type="button" className={styles.closeBtn} onClick={() => onClose({ score, started })} aria-label="Close">
            ×
          </button>
        </div>
      </div>

      {!minimized && <div
        className={styles.board}
        data-whack-board
        style={{ '--game-bg': `url(${BACKGROUND})` } as CSSProperties}
      >
        <div className={styles.holes} aria-label="Whack a mole holes">
          {Array.from({ length: HOLE_COUNT }).map((_, i) => {
            const isActive = activeHole === i
            const grandma = GRANDMAS[activeGrandma]

            return (
              <button
                key={i}
                type="button"
                className={styles.hole}
                onClick={(event) => handleHoleClick(i, event)}
                aria-label={`Hole ${i + 1}`}
              >
                {isActive && (
                  <img
                    className={styles.grandma}
                    src={grandma.default}
                    alt={grandma.name}
                    data-whack-grandma
                    draggable={false}
                  />
                )}
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
              <p className={styles.score}>Score: {score}</p>
              <p className={styles.timer} aria-label={`${remainingSeconds} seconds remaining`}>
                {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
              </p>
              <div className={styles.lives} aria-label={`${lives} lives left`}>
                {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                  <img
                    key={i}
                    className={i < lives && lifeFlickerId > 0 ? styles.lifeFlicker : styles.life}
                    src={i < lives ? LIFE_FULL : LIFE_EMPTY}
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
              <h2
                className={styles.startTitle}
                data-node-id="916:53140"
                data-text="Whack a Grandma"
              >
                Whack a Grandma
              </h2>
            )}
            {gameOver && onContinue ? (
              <div className={styles.endActions}>
                <button type="button" className={styles.startBtn} onClick={handleStart}>Try again</button>
                <button type="button" className={styles.continueBtn} onClick={() => onContinue({ score, started })}>
                  Back to the cases
                </button>
              </div>
            ) : (
              <button type="button" className={styles.startBtn} onClick={handleStart}>
                {gameOver ? 'Play again' : 'Start'}
              </button>
            )}
          </div>
        )}

        {running && hammerStrike && (
          <img
            key={hammerStrike.id}
            className={styles.hammer}
            src={`${HAMMER}?strike=${hammerStrike.id}`}
            alt=""
            draggable={false}
            style={{
              transform: `translate(${hammerStrike.x - HAMMER_ANCHOR_X}px, ${hammerStrike.y - HAMMER_ANCHOR_Y}px)`,
            }}
          />
        )}
      </div>}
    </div>
  )
}
