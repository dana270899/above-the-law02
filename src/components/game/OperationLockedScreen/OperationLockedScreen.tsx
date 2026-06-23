import styles from './OperationLockedScreen.module.css'

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
}

export function OperationLockedScreen({ onClose }: OperationLockedScreenProps) {
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
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <LockIcon />

        <h2 id="op-locked-title" className={styles.title}>
          Operation locked
        </h2>
        <p className={styles.body}>
          You can't launch an operation yet. Keep reviewing cases — the
          boss will let you know when it's time.
        </p>

        <button
          type="button"
          className={styles.okBtn}
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  )
}

/* Padlock icon — inline so we don't rely on extra asset files. */
function LockIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Shackle */}
      <path
        d="M20 28 V20 a12 12 0 0 1 24 0 V28"
        fill="none"
        stroke="#171717"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Body */}
      <rect
        x="12"
        y="28"
        width="40"
        height="30"
        rx="5"
        fill="#ffd400"
        stroke="#171717"
        strokeWidth="3"
      />
      {/* Keyhole */}
      <circle cx="32" cy="40" r="4" fill="#171717" />
      <rect x="30" y="40" width="4" height="10" fill="#171717" />
    </svg>
  )
}
