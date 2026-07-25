import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './Eilat.module.css'

export interface EilatProps {
  className?: string
  src?: string
  blobId?: string
}

/** Eilat win scene. Additional interactive layers can be added here
 * without changing the win-screen registry or game-flow integration. */
export function Eilat({ className, src: srcOverride, blobId }: EilatProps = {}) {
  const { src, label, handleError } = useWinScreenBackground({
    variant: 'eilat',
    src: srcOverride,
    blobId,
  })

  return (
    <div
      className={[styles.screen, className].filter(Boolean).join(' ')}
      data-node="win-eilat"
    >
      <img
        className={styles.background}
        src={src}
        alt={label}
        draggable={false}
        onError={handleError}
      />
    </div>
  )
}
