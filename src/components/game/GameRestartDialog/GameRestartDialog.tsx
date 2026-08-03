import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './GameRestartDialog.module.css'

const COUNTDOWN_SECONDS = 60
const DEFAULT_IDLE_MS = 90 * 1000

interface GameRestartDialogProps {
  idleAfterMs?: number
  preview?: boolean
  onRestart?: () => void
}

export function GameRestartDialog({
  idleAfterMs = DEFAULT_IDLE_MS,
  preview = false,
  onRestart = () => window.location.reload(),
}: GameRestartDialogProps) {
  const [open, setOpen] = useState(preview)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)
  const openRef = useRef(preview)
  const idleTimerRef = useRef<number | null>(null)
  const countdownDeadlineRef = useRef<number | null>(
    preview ? Date.now() + COUNTDOWN_SECONDS * 1000 : null,
  )

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }, [])

  const showDialog = useCallback(() => {
    clearIdleTimer()
    openRef.current = true
    countdownDeadlineRef.current = Date.now() + COUNTDOWN_SECONDS * 1000
    setSecondsLeft(COUNTDOWN_SECONDS)
    setOpen(true)
  }, [clearIdleTimer])

  const armIdleTimer = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(showDialog, idleAfterMs)
  }, [clearIdleTimer, idleAfterMs, showDialog])

  const stayInGame = useCallback(() => {
    openRef.current = false
    countdownDeadlineRef.current = null
    setOpen(false)
    setSecondsLeft(COUNTDOWN_SECONDS)
    armIdleTimer()
  }, [armIdleTimer])

  useEffect(() => {
    if (!preview) armIdleTimer()
    const noteActivity = () => {
      if (!openRef.current) armIdleTimer()
    }
    window.addEventListener('mousemove', noteActivity, { passive: true })
    return () => {
      clearIdleTimer()
      window.removeEventListener('mousemove', noteActivity)
    }
  }, [armIdleTimer, clearIdleTimer, preview])

  useEffect(() => {
    if (!open) return
    const tick = () => {
      const deadline = countdownDeadlineRef.current
      if (deadline == null) return
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setSecondsLeft(next)
      if (next === 0) onRestart()
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [onRestart, open])

  if (!open) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className={styles.layer} role="presentation">
      <section className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="game-restart-title">
        <header className={styles.titleBar}>
          <h2 id="game-restart-title">Game restart</h2>
          <div className={styles.windowControls}>
            <button className={styles.close} type="button" aria-label="Close" onClick={stayInGame}>
              <span aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.message}>
            <p>Are you still here?<br />Game restarts in:</p>
            <time dateTime={`PT${secondsLeft}S`}>{formattedTime}</time>
          </div>
          <div className={styles.actions}>
            <button className={styles.stayButton} type="button" onClick={stayInGame}>
              I’m here, don’t fire me!
            </button>
            <button className={styles.restartButton} type="button" onClick={onRestart}>
              Restart game
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
