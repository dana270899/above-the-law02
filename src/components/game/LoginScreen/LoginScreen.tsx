import { useState, type KeyboardEvent } from 'react'
import { assetUrl } from '@/lib/paths'
import styles from './LoginScreen.module.css'

/**
 * LOGIN SCREEN
 * Pixel-perfect implementation of the Figma "Login Screen" frame.
 * Accepts ANY non-empty input. Button is disabled until the player types something.
 *
 * `onLogin` is invoked with the trimmed name when the form is submitted.
 * The game flow uses this to advance to the next node in the graph.
 */
export interface LoginScreenProps {
  onLogin?: (name: string) => void
}

export function LoginScreen({ onLogin }: LoginScreenProps = {}) {
  const [value, setValue] = useState('')

  function handleLogin() {
    const name = value.trim()
    if (!name) return                     // block empty submissions
    onLogin?.(name)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className={styles.screen} data-node="login">

      {/* Top decorative bar */}
      <div className={`${styles.bar} ${styles.barTop}`} />

      {/* "Welcome" heading */}
      <h1 className={styles.welcome}>Welcome</h1>

      {/* Center group: badge + divider + player + form */}
      <div className={styles.center}>

        {/* Police badge */}
        <div className={styles.badge}>
          <img src={assetUrl('/images/Logo.svg')} className={styles.badgeLogo} alt="" />
        </div>

        {/* Vertical divider */}
        <div className={styles.divider} />

        {/* Player avatar + login form */}
        <div className={styles.loginGroup}>

          {/* Player character */}
          <div className={styles.avatar}>
            <img src={assetUrl('/images/Player.svg')} className={styles.player} alt="" />
          </div>

          {/* Name label + password row */}
          <div className={styles.fields}>
            <p className={styles.name}>Aviel Levy</p>
            <div className={styles.row}>
              <input
                type="password"
                className={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKey}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className={styles.loginBtn}
                onClick={handleLogin}
                aria-label="Login"
                disabled={!value.trim()}
              >
                <img src={assetUrl('/images/arrow-forward.svg')} alt="" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom decorative bar */}
      <div className={`${styles.bar} ${styles.barBottom}`} />
    </div>
  )
}
