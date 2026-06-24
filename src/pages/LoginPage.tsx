import { useNavigate } from 'react-router-dom'
import { LoginScreen } from '@/components/game/LoginScreen/LoginScreen'
import styles from './LoginPage.module.css'

/**
 * LOGIN PAGE
 * Hosts the LoginScreen design in the real viewport so it can reflow
 * across desktop, tablet, and phone sizes.
 *
 * After a successful login this advances to the desktop (`/`).
 * The actual game-flow graph is driven from `/game` — this page is the
 * standalone entry point that the LoginNode link and the Components tab
 * preview both target.
 */
export function LoginPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.canvas}>
      <LoginScreen onLogin={() => navigate('/game')} />
    </div>
  )
}
