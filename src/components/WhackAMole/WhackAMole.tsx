import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './WhackAMole.module.css'

/* ============================================================
   WhackAMole — mini in-desktop window game.

   Mounted as an overlay on the desktop (via DesktopPage). The
   player presses Start, moles randomly pop up in one of three
   holes, and they have 3 lives — they lose one for either:
     - clicking an empty hole, or
     - letting a mole hide without hitting it.

   The mole/hammer image assets live under /images/whack/ and
   may be added by the user later — CSS fallbacks keep the
   game fully playable before they arrive.
   ============================================================ */

const HOLE_COUNT = 3
const STARTING_LIVES = 3
const MOLE_VISIBLE_MS = 900       // how long a mole stays up before escaping
const GAP_BETWEEN_MOLES_MS = 400  // pause between one mole hiding and the next appearing

const MOLE_IMAGES = [
  '/images/whack/mole-1.png',
  '/images/whack/mole-2.png',
  '/images/whack/mole-3.png',
]

export type WhackAMoleProps = {
  /** Close the window (parent unmounts). */
  onClose: () => void
}

export function WhackAMole({ onClose }: WhackAMoleProps) {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [activeHole, setActiveHole] = useState<number | null>(null)
  const [activeMoleImage, setActiveMoleImage] = useState(0)

  // Refs so timer callbacks read the latest values without
  // re-creating the recursive schedule on every state change.
  const showTimerRef = useRef<number | null>(null)
  const gapTimerRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
  }, [])

  const endRound = useCallback(
    (over: boolean) => {
      runningRef.current = false
      clearTimers()
      setActiveHole(null)
      setRunning(false)
      setGameOver(over)
    },
    [clearTimers],
  )

  // Drop one life. The lives-watching effect below ends the round
  // when it hits zero — keeping side effects out of the setState updater.
  const loseLife = useCallback(() => {
    setLives((prev) => Math.max(prev - 1, 0))
  }, [])

  useEffect(() => {
    if (running && lives <= 0) endRound(true)
  }, [running, lives, endRound])

  // Recursive timeout loop: gap → show → (hide or hit) → next.
  const scheduleNextMole = useCallback(() => {
    if (!runningRef.current) return
    gapTimerRef.current = window.setTimeout(() => {
      if (!runningRef.current) return
      const holeIdx = Math.floor(Math.random() * HOLE_COUNT)
      const moleIdx = Math.floor(Math.random() * MOLE_IMAGES.length)
      setActiveHole(holeIdx)
      setActiveMoleImage(moleIdx)
      showTimerRef.current = window.setTimeout(() => {
        if (!runningRef.current) return
        // Mole escaped — costs a life, then schedule the next.
        setActiveHole(null)
        loseLife()
        scheduleNextMole()
      }, MOLE_VISIBLE_MS)
    }, GAP_BETWEEN_MOLES_MS)
  }, [loseLife])

  const handleStart = () => {
    clearTimers()
    setScore(0)
    setLives(STARTING_LIVES)
    setGameOver(false)
    setActiveHole(null)
    setRunning(true)
    runningRef.current = true
    scheduleNextMole()
  }

  const handleStop = () => {
    endRound(false)
  }

  const handleHoleClick = (i: number) => {
    if (!running) return
    if (activeHole === i) {
      // Hit! Cancel the auto-hide so it doesn't double-charge the player.
      if (showTimerRef.current !== null) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
      setScore((s) => s + 1)
      setActiveHole(null)
      scheduleNextMole()
    } else {
      // Empty hole — lose a life, but leave the current mole alone.
      loseLife()
    }
  }

  // Safety net: if the window unmounts (close X) mid-round, kill timers.
  useEffect(() => {
    return () => {
      runningRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  return (
    <div className={running ? styles.windowRunning : styles.window}>
      <div className={styles.titleBar}>
        <span className={styles.title}>Whack-a-Mole</span>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className={styles.scoreRow}>
        <span>Score: {score}</span>
        <span>Lives: {lives}</span>
      </div>

      <div className={styles.holes}>
        {Array.from({ length: HOLE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={styles.hole}
            onClick={() => handleHoleClick(i)}
            aria-label={`Hole ${i + 1}`}
          >
            {activeHole === i && (
              <img
                className={styles.mole}
                src={MOLE_IMAGES[activeMoleImage]}
                alt="Mole"
                draggable={false}
              />
            )}
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        {gameOver && !running && <div className={styles.gameOver}>Game Over</div>}
        {running ? (
          <button type="button" className={styles.stopBtn} onClick={handleStop}>
            Stop
          </button>
        ) : (
          <button type="button" className={styles.startBtn} onClick={handleStart}>
            {gameOver ? 'Play Again' : 'Start'}
          </button>
        )}
      </div>
    </div>
  )
}
