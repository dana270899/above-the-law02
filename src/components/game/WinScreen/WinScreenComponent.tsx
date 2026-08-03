import type { WinVariant } from '@/lib/winScreenImage'
import { assetUrl } from '@/lib/paths'
import { Graffiti } from './Graffiti'
import { PunchingDummy } from './PunchingDummy'
import { PunchingDummyClick } from './PunchingDummyClick'
import { KippahCutting } from './KippahCutting'
import { KippahCuttingWorkshop } from './KippahCuttingWorkshop'
import { BdsmParty } from './BdsmParty'
import { Pizza } from './Pizza'
import { Picnic } from './Picnic'
import { Eilat } from './Eilat'
import styles from './WinScreenComponent.module.css'

/* ═══════════════════════════════════════════════
   WIN SCREEN DISPATCHER

   Resolves a `WinVariant` id to the concrete win
   screen component. Used by the game flow (the
   result node carries the chosen variant) and by
   the editor's `/win/*` preview routes.

   Falls back to Graffiti when the id is missing or
   unknown — same default behavior as the win-screen
   registry in `lib/winScreens.ts`.
════════════════════════════════════════════════ */

export interface WinScreenComponentProps {
  variant?: WinVariant
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  debug?: boolean
}

const DEFAULT_WIN_TITLE = 'Win'
const DEFAULT_WIN_FOOTER_TEXT = 'Winning is so good'
const DEFAULT_WIN_CTA_LABEL = 'Love this job, next case!'
const WINDOWED_VARIANTS: ReadonlySet<WinVariant> = new Set([
  'punching-dummy-click',
  'kippah-cutting-workshop',
  'bdsm-party',
  'pizza',
  'picnic',
])

export function WinScreenComponent({
  variant,
  className,
  onComplete,
  winTitle = DEFAULT_WIN_TITLE,
  winFooterText = DEFAULT_WIN_FOOTER_TEXT,
  winCtaLabel = DEFAULT_WIN_CTA_LABEL,
  ...rest
}: WinScreenComponentProps) {
  const resolvedVariant = variant ?? 'graffiti'
  const passThroughProps = {
    ...rest,
    className: [styles.framedWindowInner, className].filter(Boolean).join(' '),
    onComplete,
    winTitle,
    winFooterText,
    winCtaLabel,
  }
  const contentProps = {
    ...rest,
    className: styles.framedContent,
  }
  let inner
  switch (resolvedVariant) {
    case 'punching-dummy':
      inner = <PunchingDummy {...contentProps} />
      break
    case 'punching-dummy-click':
      inner = <PunchingDummyClick {...passThroughProps} />
      break
    case 'kippah-cutting':
      inner = <KippahCutting {...contentProps} />
      break
    case 'kippah-cutting-workshop':
      inner = <KippahCuttingWorkshop {...passThroughProps} />
      break
    case 'bdsm-party':
      inner = <BdsmParty {...passThroughProps} />
      break
    case 'pizza':
      inner = <Pizza {...passThroughProps} />
      break
    case 'picnic':
      inner = <Picnic {...passThroughProps} />
      break
    case 'eilat':
      inner = <Eilat {...contentProps} />
      break
    case 'graffiti':
    default:
      inner = <Graffiti {...contentProps} />
  }
  const output = WINDOWED_VARIANTS.has(resolvedVariant) ? inner : (
    <div
      className={[styles.window, styles.framedWindowInner, className].filter(Boolean).join(' ')}
      data-node={`win-${resolvedVariant}`}
    >
      <div className={styles.upperBar}>
        <span className={styles.upperBarTitle}>{winTitle}</span>
        <div className={styles.upperBarBtns}>
          <button
            type="button"
            className={`${styles.chromeBtn} ${styles.chromeClose}`}
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              onComplete?.()
            }}
          >
            <img src={assetUrl('/images/case-window/close.svg')} alt="" />
          </button>
        </div>
      </div>
      <div className={styles.screen} data-win-content>
        {inner}
      </div>
      <div className={styles.footerBar}>
        <p className={styles.footerText}>{winFooterText}</p>
        <button
          type="button"
          className={styles.footerCta}
          onClick={(e) => {
            e.stopPropagation()
            onComplete?.()
          }}
        >
          <span className={styles.footerCtaLabel}>{winCtaLabel}</span>
        </button>
      </div>
    </div>
  )
  // Wrap in a pop-in container so every variant gets the same entrance
  // animation when the walker reaches a new win-result. The variant's
  // own className (passed through via `rest`) is unchanged.
  return (
    <div className={styles.popWrapper}>
      <div className={styles.greyFrame}>{output}</div>
    </div>
  )
}
