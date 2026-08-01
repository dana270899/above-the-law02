import { assetUrl } from '@/lib/paths'
import styles from './MobileNotice.module.css'

const MOBILE_NOTICE_ASSETS = assetUrl('/images/mobile-notice')

export function MobileNotice() {
  return (
    <main className={styles.page}>
      <img
        className={styles.logo}
        src={`${MOBILE_NOTICE_ASSETS}/logo.webp`}
        alt="Above the Law"
        width={200}
        height={253}
        decoding="async"
      />

      <img
        className={styles.illustration}
        src={`${MOBILE_NOTICE_ASSETS}/boss-on-crocodile.webp`}
        alt=""
        width={936}
        height={465}
        decoding="async"
      />

      <p className={styles.message}>
        This is a desktop-only game.<br />
        Do you want to end up in jail?
      </p>
    </main>
  )
}
