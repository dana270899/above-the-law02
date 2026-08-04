import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { BossMessage } from '@/components/game/BossMessage/BossMessage'
import { Subtitles } from '@/components/game/Subtitles'
import { CaseWindowV2 as CaseWindow, DEFAULT_CASE_DATA } from '@/components/CaseWindow'
import {
  FootageWindow,
  DEFAULT_FOOTAGE_DATA,
  DEFAULT_INDECENT_EXPOSURE_DATA,
} from '@/components/FootageWindow'
import {
  OperationWindow,
  DEFAULT_OPERATION_DATA,
  type ToggleKey,
} from '@/components/OperationWindow'
import {
  OperationWindowV2,
  DEFAULT_OPERATION_V2_DATA,
  type OperationItemKey,
} from '@/components/OperationWindowV2'
import { AchievementsWindow, type CaseOutcome } from '@/components/AchievementsWindow'
import {
  clearWinScreenImage,
  loadWinScreenImage,
  saveWinScreenImage,
  winScreenImageKey,
  WIN_IMAGE_EVENT,
  type WinImageEventDetail,
  type WinVariant,
} from '@/lib/winScreenImage'
import { appPath, assetUrl } from '@/lib/paths'
import styles from './ComponentsTab.module.css'

const COMPONENT_SECTIONS = [
  { id: 'login-screen', label: 'Login Screen' },
  { id: 'win-screen', label: 'Win Screen' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'case-window', label: 'Case Window' },
  { id: 'footage-window', label: 'Footage Window' },
  { id: 'operation-window', label: 'Operation Window' },
  { id: 'operation-window-v2', label: 'Operation Window V2' },
  { id: 'achievements-window', label: 'Achievements Window' },
  { id: 'subtitles', label: 'Subtitles' },
  { id: 'boss-message', label: 'Boss Message' },
] as const

const WIN_SCREEN_OPTIONS = [
  {
    variant: 'bdsm-party',
    label: 'BDSM Party',
    defaultPath: '/images/win-screens/BdsmParty/bg.svg',
  },
  {
    variant: 'pizza',
    label: 'Pizza',
    defaultPath: '/images/win-screens/Pizza/bg.svg',
  },
  {
    variant: 'picnic',
    label: 'Picnic',
    defaultPath: '/images/win-screens/Picnic/Bg.svg',
  },
  {
    variant: 'eilat',
    label: 'Eilat',
    defaultPath: '/images/win-screens/Eilat/WinScreen_Eilat-bg.svg',
  },
  {
    variant: 'kippah-cutting-workshop',
    label: 'Kippah Cutting Workshop',
  },
  {
    variant: 'graffiti',
    label: 'Graffiti',
    defaultPath: '/images/win-screens/Win03.svg',
  },
  {
    variant: 'punching-dummy',
    label: 'Punching Dummy',
    defaultPath: '/images/win-screens/PunchingDummy/PunchingDummy_bg.png',
  },
  {
    variant: 'punching-dummy-click',
    label: 'Punching Dummy (Click)',
    defaultPath: '/images/win-screens/PunchingDummy/PunchingDummy_bg.png',
  },
  {
    variant: 'kippah-cutting',
    label: 'Kippah Cutting',
    defaultPath: '/images/win-screens/WinScreen_KippahCutting.svg',
  },
] as const

type WinScreenOption = (typeof WIN_SCREEN_OPTIONS)[number]

const CASE_HIGHLIGHT_PREVIEW_DATA = {
  ...DEFAULT_CASE_DATA,
  criminalRecord: [
    {
      id: 'c1',
      text: 'Unauthorized assembly',
      status: 'Convicted',
      statusColor: 'red' as const,
      date: '22/08/2020',
      details: 'Prior case note used to preview the criminal record highlight.',
    },
  ],
  suspicions: [
    {
      ...DEFAULT_CASE_DATA.suspicions[0],
      fileFootageVariant: 'graffiti' as const,
    },
  ],
}

export function ComponentsTab() {
  // Local state for the Operation Window preview, so clicking
  // a toggle in the components-tab preview actually flips it.
  const [opToggles, setOpToggles] = useState(DEFAULT_OPERATION_DATA.toggles)
  function flipToggle(key: ToggleKey, on: boolean) {
    setOpToggles((prev) => ({ ...prev, [key]: on }))
  }

  // Local state for the V2 (counter-based) preview.
  const [opCountersV2, setOpCountersV2] = useState(
    DEFAULT_OPERATION_V2_DATA.counters,
  )
  function changeCounterV2(key: OperationItemKey, value: number) {
    setOpCountersV2((prev) => ({ ...prev, [key]: value }))
  }

  // Achievements Window demos — replayable previews of the two flicker
  // animations. The entry-flicker card uses a `key` that increments on
  // each click so React remounts the window; the AchievementsWindow's
  // `forceEntryFlicker` prop bypasses the once-per-session guard so the
  // animation actually plays every time. The new-rank card mutates one
  // slot from null → 'win' to trigger the per-chevron flicker.
  const [entryFlickerKey, setEntryFlickerKey] = useState(0)
  const [rankResults, setRankResults] = useState<CaseOutcome[]>(
    () => Array(6).fill(null),
  )
  function earnNextRank() {
    setRankResults((prev) => {
      const next = [...prev]
      const slot = next.findIndex((v) => v !== 'win')
      if (slot === -1) return Array(6).fill(null)
      next[slot] = 'win'
      return next
    })
  }
  function resetRanks() {
    setRankResults(Array(6).fill(null))
  }

  // Subtitles preview — remount on click so the timed cues replay from
  // the top. The component's clock starts when it mounts, so changing
  // the key is the cleanest way to rewind it.
  const [subtitleReplayKey, setSubtitleReplayKey] = useState(0)
  const SUBTITLE_PREVIEW_CUES = [
    { at: 0, text: 'Get to the office.' },
    { at: 2, text: 'We have a new case.' },
    { at: 4.5, text: '' },
  ]

  function scrollToAnchor(id: string) {
    const section = document.getElementById(id)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section?.focus({ preventScroll: true })
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.anchorNav} aria-label="Components on this page">
        {COMPONENT_SECTIONS.map(({ id, label }) =>
          id === 'win-screen' ? (
            <label key={id} className={styles.anchorSelect}>
              <span className={styles.visuallyHidden}>Jump to win screen</span>
              <select
                defaultValue="win-screen"
                aria-label="Jump to win screen"
                onChange={(event) => {
                  if (event.target.value) scrollToAnchor(event.target.value)
                }}
              >
                <option value="win-screen">Win Screen</option>
                {WIN_SCREEN_OPTIONS.map(({ variant, label: optionLabel }) => (
                  <option key={variant} value={`win-screen-${variant}`}>
                    {optionLabel}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <a
              key={id}
              className={styles.anchorChip}
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault()
                scrollToAnchor(id)
              }}
            >
              {label}
            </a>
          ),
        )}
      </nav>

      <section id="login-screen" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Login Screen</h2>
          <span className={styles.sectionMeta}>src/components/game/LoginScreen</span>
        </header>
        <div className={styles.desktopFrame}>
          <iframe src={appPath('/login')} title="Login Screen preview" />
        </div>
      </section>

      <section id="win-screen" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Win Screen</h2>
          <span className={styles.sectionMeta}>src/components/game/WinScreen</span>
        </header>
        <div className={styles.messageGrid}>
          {WIN_SCREEN_OPTIONS.map((option) => (
            <WinScreenPreview key={option.variant} option={option} />
          ))}
        </div>
      </section>

      <section id="desktop" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Desktop</h2>
          <span className={styles.sectionMeta}>src/components/Desktop</span>
        </header>
        <div className={styles.desktopFrame}>
          <iframe src={appPath('/')} title="Desktop preview" />
        </div>
      </section>

      <section id="case-window" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Case Window</h2>
          <span className={styles.sectionMeta}>src/components/CaseWindow</span>
        </header>
        <p className={styles.sectionNote}>
          Parent design — edits to this component propagate to every case node
          and every play-mode scenario. Per-case content (photo, text fields,
          attachments) is edited on the individual case nodes.
        </p>
        <div className={styles.caseStage}>
          <CaseWindow data={DEFAULT_CASE_DATA} />
        </div>
        <div className={styles.highlightPreviewGrid}>
          <CaseHighlightPreview
            title="Case photo + text header + ID text"
            variant="identity"
          />
          <CaseHighlightPreview
            title="Suspicions + criminal record sections"
            variant="records"
          />
          <CaseHighlightPreview
            title="Suspicion attachment file"
            variant="attachment"
          />
        </div>
      </section>

      <section id="footage-window" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Footage Window</h2>
          <span className={styles.sectionMeta}>src/components/FootageWindow</span>
        </header>
        <p className={styles.sectionNote}>
          Parent design — edits to this component propagate to every footage
          node and every play-mode scenario. Per-footage content (video id,
          timestamp, tag text) is edited on the individual footage nodes.
          Variants share the same chrome and timestamp burn-in; each renders
          a different sketch body.
        </p>
        <div className={styles.messageGrid}>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Graffiti</p>
            <div className={styles.caseStage}>
              <FootageWindow data={DEFAULT_FOOTAGE_DATA} variant="graffiti" />
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Graffiti (video)</p>
            <div className={styles.caseStage}>
              <FootageWindow data={DEFAULT_FOOTAGE_DATA} variant="graffiti-video" />
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Jewish violence</p>
            <div className={styles.caseStage}>
              <FootageWindow data={DEFAULT_FOOTAGE_DATA} variant="jewish-violence" />
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Indecent exposure</p>
            <div className={styles.caseStage}>
              <FootageWindow
                data={DEFAULT_INDECENT_EXPOSURE_DATA}
                variant="indecent-exposure"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="operation-window" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Operation Window</h2>
          <span className={styles.sectionMeta}>src/components/OperationWindow</span>
        </header>
        <p className={styles.sectionNote}>
          Parent design — edits to this component propagate everywhere the
          Operation Window appears. Per-operation content (title, footer
          text, CTA label, which toggles are on) is passed via the data prop.
        </p>
        <div className={styles.caseStage}>
          <OperationWindow
            data={{ ...DEFAULT_OPERATION_DATA, toggles: opToggles }}
            onToggle={flipToggle}
          />
        </div>
      </section>

      <section id="operation-window-v2" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Operation Window V2</h2>
          <span className={styles.sectionMeta}>src/components/OperationWindowV2</span>
        </header>
        <p className={styles.sectionNote}>
          Counter-based redesign of the planner. Each item has a − / + stepper
          instead of an on/off toggle; the cart badge tracks the total count.
          The original Operation Window above is kept intact for the existing
          toggle-based flow.
        </p>
        <div className={styles.caseStage}>
          <OperationWindowV2
            data={{ ...DEFAULT_OPERATION_V2_DATA, counters: opCountersV2 }}
            onChangeCounter={changeCounterV2}
          />
        </div>
      </section>

      <section id="achievements-window" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Achievements Window</h2>
          <span className={styles.sectionMeta}>src/components/AchievementsWindow</span>
        </header>
        <p className={styles.sectionNote}>
          Parent design — appears on the desktop and syncs to the player's
          wins/losses. Each pill reflects a case outcome (green = win,
          red = lose, empty = not played); prizes unlock as cases are won.
        </p>
        <div className={styles.messageGrid}>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>First appearance flicker</p>
            <p className={styles.sectionNote}>
              Plays the whole-bar entry animation — the bar flickers between
              the empty state (plain shield + white chevrons) and the full
              state (gold shield + yellow chevrons), then settles on the
              player's actual results. Click <strong>Replay</strong> to
              remount the window and see it again.
            </p>
            <div className={styles.caseStage}>
              <AchievementsWindow
                key={entryFlickerKey}
                forceEntryFlicker
                results={['win', 'win', null, null, null, null]}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setEntryFlickerKey((k) => k + 1)}
                style={{
                  padding: '6px 14px',
                  background: '#fffbe6',
                  border: '1px solid #b58900',
                  borderRadius: 4,
                  color: '#8a6500',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'var(--cursor-hover)',
                }}
              >
                Replay
              </button>
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>New rank flicker</p>
            <p className={styles.sectionNote}>
              Plays the single-chevron animation that fires when a level is
              promoted (chevron pulses yellow over ~600ms then settles).
              Click <strong>Earn next rank</strong> to flip the next empty
              slot to a win and watch it flicker.
            </p>
            <div className={styles.caseStage}>
              <AchievementsWindow results={rankResults} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={earnNextRank}
                style={{
                  padding: '6px 14px',
                  background: '#e6f5e6',
                  border: '1px solid #4a8a4a',
                  borderRadius: 4,
                  color: '#2d5a2d',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'var(--cursor-hover)',
                }}
              >
                Earn next rank
              </button>
              <button
                type="button"
                onClick={resetRanks}
                style={{
                  padding: '6px 14px',
                  background: '#f5f5f5',
                  border: '1px solid #999',
                  borderRadius: 4,
                  color: '#444',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'var(--cursor-hover)',
                }}
              >
                Reset
              </button>
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Empty</p>
            <div className={styles.caseStage}>
              <AchievementsWindow />
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>In progress</p>
            <div className={styles.caseStage}>
              <AchievementsWindow
                results={['win', 'win', 'lose', null, null, null, null, null]}
              />
            </div>
          </div>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>All wins</p>
            <div className={styles.caseStage}>
              <AchievementsWindow
                results={['win', 'win', 'win', 'win', 'win', 'win', 'win', 'win']}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="subtitles" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Subtitles</h2>
          <span className={styles.sectionMeta}>src/components/game/Subtitles</span>
        </header>
        <p className={styles.sectionNote}>
          Bottom-of-desktop overlay shown during voice messages. White
          ArbelHagilda Bold with a black stroke; cues swap on a timer.
          Click <strong>Replay</strong> to restart the timeline.
        </p>
        <div className={styles.subtitleStage}>
          <Subtitles key={subtitleReplayKey} cues={SUBTITLE_PREVIEW_CUES} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setSubtitleReplayKey((k) => k + 1)}
            style={{
              padding: '6px 14px',
              background: '#fffbe6',
              border: '1px solid #b58900',
              borderRadius: 4,
              color: '#8a6500',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'var(--cursor-hover)',
            }}
          >
            Replay
          </button>
        </div>
      </section>

      <section id="boss-message" className={styles.section} tabIndex={-1}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Boss Message</h2>
          <span className={styles.sectionMeta}>src/components/game/BossMessage</span>
        </header>
        <div className={styles.messageGrid}>
          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Text</p>
            <div className={styles.messageStage}>
              <BossMessage type="text" text="Get to the office. We have a new case." />
            </div>
          </div>

          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Voice</p>
            <div className={styles.messageStage}>
              <BossMessage type="voice" />
            </div>
          </div>

          <div className={styles.messageCard}>
            <p className={styles.messageLabel}>Link</p>
            <div className={styles.messageStage}>
              <BossMessage
                type="link"
                text="Open the case file to review the evidence."
                buttonLabel="Open"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function WinScreenPreview({ option }: { option: WinScreenOption }) {
  return (
    <div
      id={`win-screen-${option.variant}`}
      className={styles.messageCard}
      tabIndex={-1}
    >
      <p className={styles.messageLabel}>{option.label}</p>
      {option.variant === 'kippah-cutting-workshop' ? (
        <div className={styles.winImageEditor}>
          <p className={styles.winImageStatus}>
            Interactive component using bundled video{' '}
            <code>{assetUrl('/images/win-screens/KippahCutting/KippahCutting.mp4')}</code>,
            cursor SVGs, cutting hand SVGs, side pieces, and scissors sound.
          </p>
        </div>
      ) : (
        <WinScreenImageEditor
          variant={option.variant as WinVariant}
          defaultPath={assetUrl(option.defaultPath)}
        />
      )}
      <div className={styles.desktopFrame}>
        <iframe
          src={appPath(`/win/${option.variant}${option.variant === 'pizza' ? '?muteAudio=1' : ''}`)}
          title={`${option.label} win screen preview`}
        />
      </div>
    </div>
  )
}

function CaseHighlightPreview({
  title,
  variant,
}: {
  title: string
  variant: 'identity' | 'records' | 'attachment'
}) {
  return (
    <div className={styles.highlightPreviewCard}>
      <p className={styles.messageLabel}>{title}</p>
      <div className={`${styles.caseStage} ${styles.highlightPreview}`} data-highlight-preview={variant}>
        <CaseWindow data={CASE_HIGHLIGHT_PREVIEW_DATA} />
      </div>
    </div>
  )
}

/**
 * Lets the user replace the Graffiti win-screen image. The picked file
 * is read as a data URL and stored in localStorage so every Graffiti
 * instance (live game, /win/graffiti route, this tab's preview iframe)
 * picks it up via the storage event.
 *
 * Limits the upload to 4 MB — localStorage caps around 5 MB on most
 * browsers, and we need headroom for the editor graph that lives in the
 * same origin's storage.
 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

interface WinScreenImageEditorProps {
  variant: WinVariant
  defaultPath: string
}

function WinScreenImageEditor({
  variant,
  defaultPath,
}: WinScreenImageEditorProps) {
  const [customSrc, setCustomSrc] = useState<string | null>(() =>
    loadWinScreenImage(variant),
  )
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Keep our "is a custom image set?" state in sync if the override is
  // changed somewhere else (another tab, or a future second editor pane).
  // Filter by variant so the Graffiti editor doesn't refresh when the
  // Punching Dummy override changes (and vice versa).
  useEffect(() => {
    function refresh() {
      setCustomSrc(loadWinScreenImage(variant))
    }
    function onWinEvent(e: Event) {
      const ce = e as CustomEvent<WinImageEventDetail>
      if (!ce.detail || ce.detail.variant === variant) refresh()
    }
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === winScreenImageKey(variant)) refresh()
    }
    window.addEventListener(WIN_IMAGE_EVENT, onWinEvent)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(WIN_IMAGE_EVENT, onWinEvent)
      window.removeEventListener('storage', onStorage)
    }
  }, [variant])

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Always clear the input so the same filename can be re-picked.
    e.target.value = ''
    if (!file) return
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, SVG, etc.).')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      setError(`Image is too large (${mb} MB). Max 4 MB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      if (!result.startsWith('data:image/')) {
        setError('Could not read the file as an image.')
        return
      }
      try {
        saveWinScreenImage(variant, result)
        setCustomSrc(result)
      } catch {
        setError(
          'Could not save the image (browser storage is full). ' +
            'Try a smaller file.',
        )
      }
    }
    reader.onerror = () => setError('Failed to read the file.')
    reader.readAsDataURL(file)
  }

  function handleReset() {
    clearWinScreenImage(variant)
    setCustomSrc(null)
    setError(null)
  }

  return (
    <div className={styles.winImageEditor}>
      <p className={styles.winImageStatus}>
        {customSrc ? (
          <>
            <strong>Custom image active.</strong> Upload another file to
            replace it, or reset to use the bundled default.
          </>
        ) : (
          <>
            Using the bundled default — <code>{defaultPath}</code>. Upload an
            image below to override it.
          </>
        )}
      </p>
      <div className={styles.winImageRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className={styles.winImageFile}
        />
        {customSrc && (
          <button
            type="button"
            className={styles.winImageReset}
            onClick={handleReset}
          >
            Reset to default
          </button>
        )}
      </div>
      {error && <p className={styles.winImageError}>{error}</p>}
    </div>
  )
}
