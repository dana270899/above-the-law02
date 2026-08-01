import { assetUrl } from '@/lib/paths'
import styles from './MobileNotice.module.css'

export function MobileNotice() {
  return (
    <main className={styles.page}>
      <img
        className={styles.logo}
        src={assetUrl('/images/login-screen/Logo-S.svg')}
        alt="Above the Law"
      />

      <img
        className={styles.illustration}
        src={assetUrl('/images/ranking-board/Boss on Crocodile.svg')}
        alt=""
      />

      <p className={styles.message}>
        This is a desktop-only game.<br />
        Do you want to end up in jail?
      </p>
    </main>
  )
}
