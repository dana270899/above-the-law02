import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
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
const HIT_HOLD_MS = 320
const START_VISIBLE_MS = 672
const START_GAP_MS = 302
const SPEED_VISIBLE_STEP_MS = 72
const SPEED_GAP_STEP_MS = 34
const MIN_VISIBLE_MS = 109
const MIN_GAP_MS = 30
const HAMMER_STRIKE_MS = 340
const HAMMER_IMPACT_PROGRESS = 0.68
const HAMMER_IMPACT_MS = Math.round(HAMMER_STRIKE_MS * HAMMER_IMPACT_PROGRESS)
const HAMMER_IMPACT_X = 88
const HAMMER_IMPACT_Y = 266
const HAMMER_OFFSET_X = 80
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
const HAMMER = assetUrl('/images/mini-game/Hammer.svg')
const BACKGROUND = assetUrl('/images/mini-game/game_bg.png')
const CLOSE_ICON = assetUrl('/images/case-window/close.svg')
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
  const livesRef = useRef(STARTING_LIVES)
  const hitPendingRef = useRef(false)
  const hammerStrikeIdRef = useRef(0)
  const previousHoleRef = useRef<number | null>(null)
  const nextGrandmaRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(OUCH_SOUND)
    audio.preload = 'auto'
    audioRef.current = audio

    return () => {
      audioRef.current = null
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
    const nextLives = Math.max(livesRef.current - 1, 0)
    livesRef.current = nextLives
    setLives(nextLives)
    setLifeFlickerId((prev) => prev + 1)

    if (lifeFlickerTimerRef.current !== null) {
      clearTimeout(lifeFlickerTimerRef.current)
    }

    lifeFlickerTimerRef.current = window.setTimeout(() => {
      setLifeFlickerId(0)
      lifeFlickerTimerRef.current = null
    }, LIFE_FLICKER_MS)

    return nextLives
  }, [])

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
        const remainingLives = loseLife()
        if (remainingLives <= 0) {
          endRound(true, 'lives')
          return
        }
        scheduleNextMole()
      }, speedRef.current.visible)
    }, speedRef.current.gap)
  }, [endRound, loseLife])

  const handleStart = () => {
    clearTimers()
    setScore(0)
    livesRef.current = STARTING_LIVES
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
  }

  useEffect(() => {
    if (!running) return

    runningRef.current = true
    const hasGameplayTimer =
      gapTimerRef.current !== null ||
      showTimerRef.current !== null ||
      hitTimerRef.current !== null

    if (hasGameplayTimer) return

    // Fast Refresh and other interrupted renders can preserve React state
    // while clearing native timers. Recover the round instead of leaving it
    // active with no future grandma scheduled.
    hitPendingRef.current = false
    if (activeHole !== null) setActiveHole(null)
    scheduleNextMole()
  }, [activeHole, running, scheduleNextMole])

  const handleHoleActivation = (
    i: number,
    event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>,
  ) => {
    if (!running) return
    if (hitPendingRef.current) return
    if (activeHole === null) return

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
      if (board) {
        const boardRect = board.getBoundingClientRect()
        const grandmaRect = grandma.getBoundingClientRect()
        const scaleX = board.offsetWidth / boardRect.width
        const scaleY = board.offsetHeight / boardRect.height
        playHammerStrikeAt(
          (grandmaRect.left + grandmaRect.width / 2 - boardRect.left) * scaleX,
          (grandmaRect.top + grandmaRect.height * 0.24 - boardRect.top) * scaleY,
        )
      }

      setScore((s) => s + POINTS_PER_HIT)
      if (hitTimerRef.current !== null) {
        clearTimeout(hitTimerRef.current)
      }
      hitTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        const audio = audioRef.current
        if (audio) {
          try {
            audio.currentTime = 0
            void audio.play().catch(() => { /* autoplay blocked — ignore */ })
          } catch {
            // Sound is optional and must not interrupt the hit sequence.
          }
        }
        hitTimerRef.current = window.setTimeout(() => {
          if (!runningRef.current) return
          setActiveHole(null)
          hitPendingRef.current = false
          scheduleNextMole()
        }, HIT_HOLD_MS)

        try {
          grandma.animate(
            [
              {
                transform: 'translate(-50%, 0)',
                clipPath: 'inset(0 0 13px 0)',
              },
              {
                transform: 'translate(-55%, -11px) rotate(-3deg) scale(1.025)',
                clipPath: 'inset(0 0 13px 0)',
                offset: 0.16,
              },
              {
                transform: 'translate(-45%, 4px) rotate(3deg) scale(0.975)',
                clipPath: 'inset(0 0 13px 0)',
                offset: 0.32,
              },
              {
                transform: 'translate(-50%, 0) rotate(0deg) scale(1)',
                clipPath: 'inset(0 0 13px 0)',
                offset: 0.46,
              },
              {
                transform: 'translate(-50%, 48px)',
                clipPath: 'inset(0 0 61px 0)',
                offset: 0.62,
              },
              {
                transform: 'translate(-50%, 190px)',
                clipPath: 'inset(0 0 203px 0)',
                offset: 0.82,
              },
              {
                transform: 'translate(-50%, 380px)',
                clipPath: 'inset(0 0 100% 0)',
              },
            ],
            { duration: HIT_HOLD_MS, easing: 'cubic-bezier(0.5, 0, 0.9, 0.45)', fill: 'forwards' },
          )
        } catch {
          // The visual effect is optional; the already-scheduled round
          // transition must continue even if Web Animations is unavailable.
        }
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
      <div className={styles.windowSurface}>
      <div className={styles.titleBar} onMouseDown={handleTitleMouseDown}>
        <span className={styles.title}>Mini Game</span>
        <div className={styles.windowActions}>
          <button
            type="button"
            className={styles.minimizeIcon}
            onClick={handleMinimize}
            aria-label={minimized ? 'Restore' : 'Minimize'}
          />
          <button type="button" className={styles.closeBtn} onClick={() => onClose({ score, started })} aria-label="Close">
            <img src={CLOSE_ICON} alt="" draggable={false} />
          </button>
        </div>
      </div>

      {!minimized && <div
        className={`${styles.board} ${running ? styles.boardRunning : ''}`}
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
                onPointerDown={(event) => {
                  if (event.button === 0) handleHoleActivation(i, event)
                }}
                onClick={(event) => {
                  // Pointer activation is handled on press for lower latency;
                  // keep keyboard activation accessible without firing twice.
                  if (event.detail === 0) handleHoleActivation(i, event)
                }}
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

        <div
          className={gameOver ? styles.scoreBarEnd : styles.scoreBar}
          data-node-id={gameOver ? '711:81716' : undefined}
        >
          {gameOver ? (
            <>
              <p className={styles.score} data-node-id="956:77485">Score: {score}</p>
              <p className={styles.endMessage} data-node-id="711:81728">
                {endReason === 'time' ? "Time's up!" : 'Loser! The grandmas win'}
              </p>
            </>
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
            className={`${styles.hammer} ${styles.hammerStriking}`}
            src={HAMMER}
            alt=""
            draggable={false}
            style={{
              '--hammer-x': `${hammerStrike.x - HAMMER_IMPACT_X + HAMMER_OFFSET_X}px`,
              '--hammer-y': `${hammerStrike.y - HAMMER_IMPACT_Y}px`,
            } as CSSProperties}
          />
        )}
      </div>}
      </div>
    </div>
  )
}
