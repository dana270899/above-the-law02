import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { assetUrl } from '@/lib/paths'
import styles from './WhackAMole.module.css'

const HOLE_COUNT = 3
const STARTING_LIVES = 3
const POINTS_PER_HIT = 10
const HIT_HOLD_MS = 220
const START_VISIBLE_MS = 1600
const START_GAP_MS = 720
const SPEED_VISIBLE_STEP_MS = 170
const SPEED_GAP_STEP_MS = 80
const MIN_VISIBLE_MS = 260
const MIN_GAP_MS = 70
const HAMMER_STRIKE_MS = 620
const HAMMER_ANCHOR_X = 100
const HAMMER_ANCHOR_Y = 500
const LIFE_FLICKER_MS = 620

type GrandmaSprite = {
  default: string
  hit: string
  name: string
}

const GRANDMAS: GrandmaSprite[] = [
  {
    name: 'Lech grandma',
    default: assetUrl('/images/mini-game/Grandma01_default.svg'),
    hit: assetUrl('/images/mini-game/Grandma01_hit.svg'),
  },
  {
    name: 'Democracy grandma',
    default: assetUrl('/images/mini-game/Grandma02_default.svg'),
    hit: assetUrl('/images/mini-game/Grandma02_hit.svg'),
  },
  {
    name: 'Peace grandma',
    default: assetUrl('/images/mini-game/Grandma03_default.svg'),
    hit: assetUrl('/images/mini-game/Grandma03_hit.svg'),
  },
]

const LIFE_FULL = assetUrl('/images/mini-game/Life-full.svg')
const LIFE_EMPTY = assetUrl('/images/mini-game/Life-empty.svg')
const HAMMER = assetUrl('/images/mini-game/Hammer_animated_fast.gif')
const BACKGROUND = assetUrl('/images/mini-game/game_bg.svg')
const OUCH_SOUND = assetUrl('/sounds/Ouch01.mp3')

export type WhackAMoleProps = {
  onClose: () => void
}

export function WhackAMole({ onClose }: WhackAMoleProps) {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [activeHole, setActiveHole] = useState<number | null>(null)
  const [activeGrandma, setActiveGrandma] = useState(0)
  const [hitHole, setHitHole] = useState<number | null>(null)
  const [hammerStrike, setHammerStrike] = useState<{ x: number; y: number; id: number } | null>(null)
  const [lifeFlickerId, setLifeFlickerId] = useState(0)

  const showTimerRef = useRef<number | null>(null)
  const gapTimerRef = useRef<number | null>(null)
  const hitTimerRef = useRef<number | null>(null)
  const hammerTimerRef = useRef<number | null>(null)
  const lifeFlickerTimerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const hammerStrikeIdRef = useRef(0)
  const previousHoleRef = useRef<number | null>(null)

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
    (over: boolean) => {
      runningRef.current = false
      clearTimers()
      setActiveHole(null)
      setHitHole(null)
      setHammerStrike(null)
      setLifeFlickerId(0)
      previousHoleRef.current = null
      setRunning(false)
      setGameOver(over)
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
    if (running && lives <= 0) endRound(true)
  }, [running, lives, endRound])

  const scheduleNextMole = useCallback(() => {
    if (!runningRef.current) return
    gapTimerRef.current = window.setTimeout(() => {
      if (!runningRef.current) return
      const availableHoles = Array.from({ length: HOLE_COUNT }, (_, i) => i).filter(
        (i) => i !== previousHoleRef.current,
      )
      const holeIdx = availableHoles[Math.floor(Math.random() * availableHoles.length)]
      const grandmaIdx = Math.floor(Math.random() * GRANDMAS.length)
      previousHoleRef.current = holeIdx
      setActiveHole(holeIdx)
      setActiveGrandma(grandmaIdx)
      setHitHole(null)
      showTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        setActiveHole(null)
        setHitHole(null)
        loseLife()
        scheduleNextMole()
      }, speedRef.current.visible)
    }, speedRef.current.gap)
  }, [loseLife])

  const handleStart = () => {
    clearTimers()
    setScore(0)
    setLives(STARTING_LIVES)
    setGameOver(false)
    setActiveHole(null)
    setHitHole(null)
    setHammerStrike(null)
    setLifeFlickerId(0)
    previousHoleRef.current = null
    setRunning(true)
    runningRef.current = true
    scheduleNextMole()
  }

  const handleHoleClick = (i: number) => {
    if (!running) return
    if (hitHole !== null) return
    if (activeHole === i) {
      if (showTimerRef.current !== null) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
      setScore((s) => s + POINTS_PER_HIT)
      setHitHole(i)
      const audio = new Audio(OUCH_SOUND)
      audio.play().catch(() => { /* autoplay blocked — ignore */ })
      if (hitTimerRef.current !== null) {
        clearTimeout(hitTimerRef.current)
      }
      hitTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        setActiveHole(null)
        setHitHole(null)
        scheduleNextMole()
      }, HIT_HOLD_MS)
    }
  }

  const playHammerStrike = (event: PointerEvent<HTMLDivElement>) => {
    if (!runningRef.current) return

    const rect = event.currentTarget.getBoundingClientRect()
    hammerStrikeIdRef.current += 1
    setHammerStrike({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
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

  const stopHammerStrike = () => {
    if (hammerTimerRef.current !== null) {
      clearTimeout(hammerTimerRef.current)
      hammerTimerRef.current = null
    }
    setHammerStrike(null)
  }

  useEffect(() => {
    return () => {
      runningRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  const showStartScreen = !running && !gameOver

  return (
    <div className={running ? styles.windowRunning : styles.window}>
      <div className={styles.titleBar}>
        <span className={styles.title}>Game</span>
        <div className={styles.windowActions}>
          <span className={styles.expandIcon} aria-hidden="true" />
          <span className={styles.minimizeIcon} aria-hidden="true" />
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      </div>

      <div
        className={styles.board}
        style={{ '--game-bg': `url(${BACKGROUND})` } as CSSProperties}
        onPointerDown={playHammerStrike}
        onPointerCancel={stopHammerStrike}
      >
        <div className={styles.holes} aria-label="Whack a mole holes">
          {Array.from({ length: HOLE_COUNT }).map((_, i) => {
            const isActive = activeHole === i
            const isHit = hitHole === i
            const grandma = GRANDMAS[activeGrandma]

            return (
              <button
                key={i}
                type="button"
                className={styles.hole}
                onClick={() => handleHoleClick(i)}
                aria-label={`Hole ${i + 1}`}
              >
                {isActive && (
                  <img
                    className={isHit ? styles.grandmaHit : styles.grandma}
                    src={isHit ? grandma.hit : grandma.default}
                    alt={grandma.name}
                    draggable={false}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className={gameOver ? styles.scoreBarEnd : styles.scoreBar}>
          {gameOver ? (
            <p className={styles.endMessage}>Loser! The grandmas win</p>
          ) : (
            <>
              <p className={styles.score}>Score: {score}</p>
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
            {showStartScreen && <h2 className={styles.startTitle}>Whack-a-Mole</h2>}
            <button type="button" className={styles.startBtn} onClick={handleStart}>
              {gameOver ? 'Start' : 'Start'}
            </button>
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
      </div>
    </div>
  )
}
