import { useEffect, useState, type ReactNode } from 'react'
import { assetUrl } from '@/lib/paths'
import styles from './Desktop.module.css'

const A = assetUrl('/images/desktop')

/* ============================================================
   Desktop — base screen used in every scenario.
   Edit this file and every screen that renders <Desktop /> updates.
   Pass `children` to overlay scenario-specific content (dialogs,
   app windows, tutorials, etc.) on top of the desktop background.
   ============================================================ */

export type DesktopProps = {
  /** Scenario-specific overlay content rendered on top of the desktop. */
  children?: ReactNode
  /** Override the time shown in the taskbar. Defaults to live clock. */
  time?: string
  /** Click handler for the START button. */
  onStartClick?: () => void
  /** Click handlers for each app icon. */
  onRulebookClick?: () => void
  onCasesClick?: () => void
  onOperationClick?: () => void
  /** Kept on the props for backwards compatibility — the icon now
   *  always renders at full color and is always clickable. The parent
   *  reacts to clicks based on its own lock state (e.g. opening a
   *  "locked" screen instead of the Operation window). */
  operationLocked?: boolean
  onTrashClick?: () => void
  onWhackClick?: () => void
  /** Full-canvas overlay rendered after the taskbar, so its
   *  `backdrop-filter` can desaturate every desktop element (icons,
   *  windows, taskbar) while content inside `children` painted at a
   *  higher z-index — e.g. the boss message — stays unaffected.
   *  Used by the tutorial spotlight. */
  tutorialOverlay?: ReactNode
}

/* ---- Rulebook (green book) ---- */
function RulebookIllustration() {
  return (
    <div className={styles.illu}>
      <img src={`${A}/RuleBook_Illustration.svg`} alt="" />
    </div>
  )
}

/* ---- Cases (filing cabinet) ---- */
function CasesIllustration() {
  return (
    <div className={styles.illu}>
      <img src={`${A}/Cases_Illustration.svg`} alt="" />
    </div>
  )
}

/* ---- Operations (red siren) ---- */
function OperationsIllustration() {
  return (
    <div className={styles.illu}>
      <img src={`${A}/Operations_Illustration.svg`} alt="" />
    </div>
  )
}

/* ---- Trash can ---- */
function TrashIllustration() {
  return (
    <div className={styles.illu}>
      <img src={`${A}/Trash_Illustration_S.svg`} alt="" />
    </div>
  )
}

/* ---- Game (whack-a-mole) ---- */
function WhackIllustration() {
  return (
    <div className={styles.illu}>
      <img src={`${A}/Whack_Illustration.svg`} alt="" />
    </div>
  )
}

function useCurrentTime() {
  const [time, setTime] = useState(() => formatTime(new Date()))
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000 * 30)
    return () => clearInterval(id)
  }, [])
  return time
}

function formatTime(d: Date) {
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

export function Desktop({
  children,
  time,
  onStartClick,
  onRulebookClick,
  onCasesClick,
  onOperationClick,
  operationLocked = false,
  onTrashClick,
  onWhackClick,
  tutorialOverlay,
}: DesktopProps) {
  const liveTime = useCurrentTime()
  const displayedTime = time ?? liveTime

  // When the tutorial spotlight is active, swap the cream desktop
  // background for its grayscale equivalent. Otherwise the in-color
  // background showing through the target SVG's transparent pixels
  // reads as a yellow card against the otherwise-grayscale screen.
  const tutorialActive = !!tutorialOverlay

  return (
    <div className={styles.desktop} data-tutorial-active={tutorialActive ? '' : undefined}>
      {/* Sidebar app icons — stays 54px from left edge at any viewport size */}
      <div className={styles.sidebar}>
        {/* `data-spot` sits on the inner illustration container, not the
            button — the button bounding box extends beyond the picture
            (gap above the label, full sidebar width), which would expose
            the desktop's cream background as a visible "card" when the
            rest of the screen is grayscaled. */}
        <div className={styles.sidebarColumn}>
          <button type="button" className={`${styles.appIcon} ${styles.appIconFirst}`} onClick={onRulebookClick}>
            <div data-spot="icon.rulebook" className={styles.iconBox}><RulebookIllustration /></div>
            <span className={styles.appLabel}>Rulebook</span>
          </button>
          <button type="button" className={styles.appIcon} onClick={onCasesClick}>
            <div data-spot="icon.cases" className={styles.iconBox}><CasesIllustration /></div>
            <span className={styles.appLabel}>Cases</span>
          </button>
          <button
            type="button"
            className={styles.appIcon}
            onClick={onOperationClick}
          >
            <div data-spot="icon.operation" className={styles.iconBox}><OperationsIllustration /></div>
            <span className={styles.appLabel}>Operation</span>
          </button>
          <button type="button" className={styles.appIcon} onClick={onTrashClick}>
            <div data-spot="icon.trash" className={styles.iconBox}><TrashIllustration /></div>
            <span className={styles.appLabel}>Trash</span>
          </button>
        </div>
        <div className={`${styles.sidebarColumn} ${styles.sidebarColumnRight}`}>
          <button type="button" className={`${styles.appIcon} ${styles.appIconFirst}`} onClick={onWhackClick}>
            <div data-spot="icon.whack" className={styles.iconBox}><WhackIllustration /></div>
            <span className={styles.appLabel}>Game</span>
          </button>
        </div>
      </div>

      {/* Center logo — stays centered in the viewport */}
      <div className={styles.logo}>
        <img src={assetUrl('/images/Logo.svg')} alt="Above the Law" />
      </div>

      {/* Scenario-specific overlay content */}
      {children && <div className={styles.overlay}>{children}</div>}

      {/* Taskbar — full-width, anchored to the bottom of the viewport */}
      <div className={styles.taskbar}>
        <button type="button" data-spot="taskbar.start" className={styles.startButton} onClick={onStartClick}>
          <span className={styles.startText}>Start</span>
        </button>
        <span className={styles.timeText}>{displayedTime}</span>
      </div>

      {/* Tutorial overlay — rendered AFTER the taskbar so its
          backdrop-filter reaches everything painted before it
          (sidebar icons, logo, windows, taskbar). The boss message
          inside `children` has a higher z-index, so it ends up
          painted on top of this overlay and stays in color. */}
      {tutorialOverlay}
    </div>
  )
}
