import { useNavigate } from 'react-router-dom'
import { useGameScale } from '@/hooks/useGameScale'
import { LoginScreen } from '@/components/game/LoginScreen/LoginScreen'
import styles from './LoginPage.module.css'

/**
 * LOGIN PAGE
 * Hosts the LoginScreen design inside the 1920×1080 game canvas.
 * `useGameScale` scales the canvas to fit any viewport.
 *
 * After a successful login this advances to the desktop (`/`).
 * The actual game-flow graph is driven from `/game` — this page is the
 * standalone entry point that the LoginNode link and the Components tab
 * preview both target.
 */
export function LoginPage() {
  const ref = useGameScale()
  const navigate = useNavigate()

  return (
    <div ref={ref} className={styles.canvas}>
      <LoginScreen onLogin={() => navigate('/game')} />
    </div>
  )
}
