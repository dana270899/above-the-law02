import type { WinVariant } from '@/lib/winScreenImage'
import { Graffiti } from './Graffiti'
import { PunchingDummy } from './PunchingDummy'
import { PunchingDummyClick } from './PunchingDummyClick'
import { KippahCutting } from './KippahCutting'
import { KippahCuttingWorkshop } from './KippahCuttingWorkshop'
import { BdsmParty } from './BdsmParty'
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
  debug?: boolean
}

export function WinScreenComponent({
  variant,
  ...rest
}: WinScreenComponentProps) {
  let inner
  switch (variant) {
    case 'punching-dummy':
      inner = <PunchingDummy {...rest} />
      break
    case 'punching-dummy-click':
      inner = <PunchingDummyClick {...rest} />
      break
    case 'kippah-cutting':
      inner = <KippahCutting {...rest} />
      break
    case 'kippah-cutting-workshop':
      inner = <KippahCuttingWorkshop {...rest} />
      break
    case 'bdsm-party':
      inner = <BdsmParty {...rest} />
      break
    case 'graffiti':
    default:
      inner = <Graffiti {...rest} />
  }
  // Wrap in a pop-in container so every variant gets the same entrance
  // animation when the walker reaches a new win-result. The variant's
  // own className (passed through via `rest`) is unchanged.
  return <div className={styles.popWrapper}>{inner}</div>
}
