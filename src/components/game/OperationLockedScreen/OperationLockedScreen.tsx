import type { ReactNode } from 'react'
import { assetUrl } from '@/lib/paths'
import styles from './OperationLockedScreen.module.css'

const CASE_ICONS = assetUrl('/images/case-window')
const OPERATION_ASSETS = assetUrl('/images/operation-window')

/* ════════════════════════════════════════════════════
   OperationLockedScreen

   A centered modal shown when the player clicks the
   Operation icon before the boss has unlocked it. The
   icon itself always looks active — this screen gives
   the feedback that the feature isn't available yet.
   ════════════════════════════════════════════════════ */

export type OperationLockedScreenProps = {
  /** Called when the user dismisses the screen (close button or
   *  backdrop click). */
  onClose: () => void
  /** Title-bar label. Defaults to the original Operation variant. */
  windowTitle?: string
  /** Locked-state explanation shown below the heading. */
  message?: ReactNode
}

export function OperationLockedScreen({
  onClose,
  windowTitle = 'Operation',
  message = "You'll know when it's time for operations. Until then, back to work!",
}: OperationLockedScreenProps) {
  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="op-locked-title"
      >
        <div className={styles.cardSurface}>
          <header className={styles.titleBar}>
            <span className={styles.windowTitle}>{windowTitle}</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close"
            >
              <img src={`${CASE_ICONS}/close.svg`} alt="" />
            </button>
          </header>

          <div className={styles.content}>
            <div className={styles.lockBadge} aria-hidden="true">
              <img src={`${OPERATION_ASSETS}/lock.svg`} alt="" />
            </div>
            <div className={styles.message}>
              <h2 id="op-locked-title" className={styles.title}>Locked</h2>
              <p className={styles.body}>{message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
