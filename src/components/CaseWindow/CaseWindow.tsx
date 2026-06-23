import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  FootageWindow,
  DEFAULT_FOOTAGE_DATA,
  DEFAULT_INDECENT_EXPOSURE_DATA,
  type FootageVariant,
} from '@/components/FootageWindow'
import { assetUrl } from '@/lib/paths'
import { WebcamFilter } from './WebcamFilter'
import styles from './CaseWindow.module.css'

/* ============================================================
   CaseWindow — the in-game "Case Window" main component.

   Single source of truth: editing the JSX / CSS here updates
   every scenario where this window appears (editor preview +
   running game).

   - editable=false (default): renders plain content (play mode).
   - editable=true: every per-case field becomes an inline input
     so the game-builder can edit content inside a case node.

   The left-side "Cases tabs" menu is configured below (CASE_TABS)
   — it is intentionally not per-case. Editing the constant updates
   the menu everywhere the window is rendered.
   ============================================================ */

const A = assetUrl('/images/case-window')

/* --- Static left-side menu config (edit here to update all usages) ---
   Used as a fallback when the parent does not pass a `tabs` prop
   (editor preview / standalone usages). The game runtime passes its
   own list of tabs derived from the saved graph. */
const DEFAULT_CASE_TABS: CaseTab[] = [
  { id: '891', time: '22:34 PM' },
  { id: '892', time: '22:34 PM' },
  { id: '893', time: '22:34 PM' },
  { id: '894', time: '22:34 PM' },
  { id: '895', time: '22:34 PM' },
  { id: '896', time: '22:34 PM' },
  { id: '897', time: '22:34 PM' },
]

/** One entry in the left-side case tab list. */
export type CaseTab = {
  /** caseId — matched against the active case body via `stripHash`. */
  id: string
  /** Right-side time label on the tab (e.g. "22:34 PM"). */
  time: string
  /** Locked tabs are dimmed and don't fire onSelect. */
  locked?: boolean
}

export type StatusColor = 'green' | 'red' | 'yellow' | 'grey'

/** Which decision the player has made on the currently displayed case.
 *  `null` / undefined → "Make a decision" view (Arrest + Release buttons). */
export type CaseDecision = 'arrested' | 'released'

export type CriminalRecordRow = {
  id: string
  text: string
  // Optional so existing saved rows (which only had `id` + `text`) still load
  // cleanly. New rows added through the editor seed all three.
  date?: string
  status?: string             // chip label, e.g. "Convicted"
  statusColor?: StatusColor   // chip color
  // Expandable body — supports **bold** and line breaks, same as suspicion.
  details?: string
}

/** One of the small status chips shown in the case header. The status
 *  chip itself (from `statusLabel` / `statusColor`) stays separate and
 *  is always rendered last; these `extraChips` sit to the left of it. */
export type CaseHeaderChip = {
  id: string
  label: string
  color: StatusColor
}

export type SuspicionRow = {
  id: string
  subject: string
  status: string
  statusColor: StatusColor
  date: string
  fileUrl: string
  details: string   // expanded body — supports **bold** and line breaks
  // Optional Footage Window attachment — when set, clicking the file
  // icon opens that footage variant in an overlay. Optional so existing
  // saved suspicion rows (which only had `fileUrl`) still load cleanly.
  fileFootageVariant?: FootageVariant
}

export type CaseWindowData = {
  caseId: string                 // shown as "Case #<id>"
  createdAt: string              // "22:34 PM"
  statusLabel: string            // "Open"
  statusColor: StatusColor
  photoUrl: string               // empty = show default illustration
  fullName: string
  idNo: string
  dob: string
  sex: string
  nationality: string
  religion: string
  religionColor: 'black' | 'red' | 'green'
  address: string
  criminalRecord: CriminalRecordRow[]
  /** Shown inside the Criminal Record card when the list is empty.
   *  Editable per case so a builder can write something like
   *  "Subject has no prior offenses." for one case and a different
   *  hint for another. Optional so older saved cases still load. */
  criminalRecordEmptyText?: string
  /** Optional badges shown in the case header, to the left of the
   *  status chip. Empty by default — the builder adds chips like
   *  "Criminal Record" or "Priority" manually so each case can have
   *  a different lineup. */
  extraChips?: CaseHeaderChip[]
  suspicions: SuspicionRow[]
  arrestLabel: string
  releaseLabel: string
}

export const DEFAULT_CASE_DATA: CaseWindowData = {
  caseId: '0890',
  createdAt: '22:34 PM',
  statusLabel: 'Open',
  statusColor: 'green',
  photoUrl: '',
  fullName: 'Adam Mahmud',
  idNo: '12345678',
  dob: '10/12/1988',
  sex: 'Male',
  nationality: 'Electan',
  religion: 'Muslim',
  religionColor: 'red',
  address: 'Khatser 5, Lod',
  criminalRecord: [],
  criminalRecordEmptyText: 'No criminal record yet.',
  extraChips: [],
  suspicions: [
    {
      id: 's1',
      subject: 'Palestinian flag graffiti',
      status: 'Urgent',
      statusColor: 'red',
      date: '08/02/2026',
      fileUrl: '',
      details:
        'Subject suspected in a **large-scale security** incident involving **Palestinian flag graffiti** on a municipal building wall.\n\nIt looks like him but we are not sure.',
    },
  ],
  arrestLabel: 'Arrest',
  releaseLabel: 'Release',
}

type CaseWindowProps = {
  data: CaseWindowData
  editable?: boolean
  onChange?: (patch: Partial<CaseWindowData>) => void
  onArrest?: () => void
  onRelease?: () => void
  /** When set, footer collapses to "Decision Made" + the matching pill
   *  (red "Arrested" / green "Released"). Drives the lower-bar variants
   *  in Figma 462:10976 (Default / Arrested / Released).
   *  `undefined` / `null` keeps the default "Make a decision" view. */
  decision?: CaseDecision | null
  /** When set, X button calls this (parent unmounts the window). */
  onClose?: () => void
  /** Optional notifier when the minimize toggle changes. */
  onMinimizeChange?: (minimized: boolean) => void
  /** When true, window becomes absolute-positioned + draggable by its title bar. */
  draggable?: boolean
  className?: string
  /**
   * Left-side tab list. If omitted, the hard-coded DEFAULT_CASE_TABS
   * is rendered (preserves the editor-preview / standalone look).
   * The game runtime passes its own list, with `locked` flags.
   */
  tabs?: CaseTab[]
  /** Click handler for an unlocked tab. Locked tabs never fire this. */
  onTabSelect?: (caseId: string) => void
  /**
   * Play-mode wrapper for per-suspicion-row clicks. The game uses this
   * to look up any Trigger nodes connected to the active case for the
   * given action+rowId, queue their messages as overlays, and run the
   * original action (toggle expand / open footage) once dismissed.
   * If undefined, the action runs immediately (no overlay).
   */
  onRowTrigger?: (
    action: 'expand' | 'attachment',
    rowId: string,
    thenRun: () => void,
  ) => void
  /**
   * When true, the photo slot shows the live webcam feed (via
   * getUserMedia) instead of the case's static ID photo. Ignored in
   * editable mode — the editor preview keeps the upload control so the
   * builder can still pick a fallback image.
   */
  useCamera?: boolean
}

export function CaseWindow({
  data,
  editable = false,
  onChange,
  onArrest,
  onRelease,
  decision,
  onClose,
  onMinimizeChange,
  draggable = false,
  className,
  tabs,
  onTabSelect,
  onRowTrigger,
  useCamera = false,
}: CaseWindowProps) {
  const tabList: CaseTab[] = tabs ?? DEFAULT_CASE_TABS
  const photoInputId = useId()

  /* --- Window UI state (local) ----------------------- */
  const [minimized, setMinimized] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedCrimRows, setExpandedCrimRows] = useState<Set<string>>(new Set())
  // Row ids like `s1` are reused across cases, so without a reset the
  // expanded state from a previous tab would carry over and a freshly
  // opened case would show its dropdown already open.
  useEffect(() => {
    setExpandedRows(new Set())
    setExpandedCrimRows(new Set())
  }, [data.caseId])
  // When a suspicion row's attachment is a Footage Window, clicking it
  // opens the chosen variant in a fixed overlay above the case window.
  const [openFootageVariant, setOpenFootageVariant] = useState<FootageVariant | null>(null)

  // Drag position. `null` means centered (initial). Once dragged, becomes {x,y}.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number; startY: number; originX: number; originY: number
  } | null>(null)
  const windowRef = useRef<HTMLDivElement | null>(null)

  // Right-side scroll column drives this scrollable container. The thumb
  // shown on the track mirrors the container's scroll position; arrow
  // buttons step the scroll up/down; the thumb itself is draggable.
  const contentRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [scrollMeta, setScrollMeta] = useState({
    thumbHeight: 0, thumbTop: 0, visible: false,
  })
  const thumbDragRef = useRef<{ startY: number; startScrollTop: number } | null>(null)

  const updateScrollMeta = useCallback(() => {
    const el = contentRef.current
    const track = trackRef.current
    if (!el || !track) return
    const trackH = track.clientHeight
    const ratio = el.clientHeight / el.scrollHeight
    const visible = ratio < 1
    const thumbHeight = visible ? Math.max(32, trackH * ratio) : 0
    const maxScroll = el.scrollHeight - el.clientHeight
    const thumbTop = maxScroll > 0
      ? (el.scrollTop / maxScroll) * (trackH - thumbHeight)
      : 0
    setScrollMeta({ thumbHeight, thumbTop, visible })
  }, [])

  useEffect(() => {
    const el = contentRef.current
    const track = trackRef.current
    if (!el || !track) return
    updateScrollMeta()
    const ro = new ResizeObserver(updateScrollMeta)
    ro.observe(el)
    ro.observe(track)
    return () => { ro.disconnect() }
  }, [minimized, updateScrollMeta])

  function scrollByStep(direction: -1 | 1) {
    const el = contentRef.current
    if (!el) return
    const delta = direction * Math.max(120, el.clientHeight * 0.4)
    el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + delta))
    // Some browsers don't fire `scroll` for programmatic scrollTop, so
    // refresh the thumb directly.
    updateScrollMeta()
  }

  function onTrackMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    // Click on empty track area scrolls one viewport in that direction.
    if (e.target !== e.currentTarget) return
    const el = contentRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const direction = clickY < scrollMeta.thumbTop ? -1 : 1
    const delta = direction * el.clientHeight * 0.85
    el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + delta))
    updateScrollMeta()
  }

  function onThumbMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    const el = contentRef.current
    if (!el) return
    thumbDragRef.current = { startY: e.clientY, startScrollTop: el.scrollTop }
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = thumbDragRef.current
      const el = contentRef.current
      const track = trackRef.current
      if (!d || !el || !track) return
      const trackH = track.clientHeight
      const maxScroll = el.scrollHeight - el.clientHeight
      const usable = trackH - scrollMeta.thumbHeight
      if (usable <= 0 || maxScroll <= 0) return
      const dy = e.clientY - d.startY
      const next = d.startScrollTop + (dy * maxScroll) / usable
      el.scrollTop = Math.max(0, Math.min(maxScroll, next))
      updateScrollMeta()
    }
    function onUp() { thumbDragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [scrollMeta.thumbHeight, updateScrollMeta])

  function set<K extends keyof CaseWindowData>(field: K, value: CaseWindowData[K]) {
    onChange?.({ [field]: value } as Partial<CaseWindowData>)
  }

  function updateCrim(rowId: string, patch: Partial<CriminalRecordRow>) {
    set('criminalRecord', data.criminalRecord.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }
  function removeCrim(rowId: string) {
    set('criminalRecord', data.criminalRecord.filter((r) => r.id !== rowId))
  }
  function addCrim() {
    set('criminalRecord', [
      ...data.criminalRecord,
      { id: `c${Date.now()}`, text: '', date: '', status: 'Convicted', statusColor: 'red' },
    ])
  }

  function updateSus(rowId: string, patch: Partial<SuspicionRow>) {
    set('suspicions', data.suspicions.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }
  function removeSus(rowId: string) {
    set('suspicions', data.suspicions.filter((r) => r.id !== rowId))
  }
  function addSus() {
    set('suspicions', [
      ...data.suspicions,
      { id: `s${Date.now()}`, subject: '', status: 'Open', statusColor: 'green', date: '', fileUrl: '', details: '' },
    ])
  }

  function updateExtraChip(chipId: string, patch: Partial<CaseHeaderChip>) {
    set('extraChips', (data.extraChips ?? []).map((c) => (c.id === chipId ? { ...c, ...patch } : c)))
  }
  function removeExtraChip(chipId: string) {
    set('extraChips', (data.extraChips ?? []).filter((c) => c.id !== chipId))
  }
  function addExtraChip() {
    set('extraChips', [
      ...(data.extraChips ?? []),
      { id: `chip${Date.now()}`, label: 'New chip', color: 'red' as StatusColor },
    ])
  }

  function toggleRow(id: string) {
    setExpandedRows((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleCrimRow(id: string) {
    setExpandedCrimRows((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onPhotoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('photoUrl', String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  function handleMinimize() {
    setMinimized((m) => {
      onMinimizeChange?.(!m)
      return !m
    })
  }

  /* --- Drag (only when draggable) -------------------- */
  function onTitleMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (!draggable) return
    // Don't start a drag when the click is on a chrome button
    if ((e.target as HTMLElement).closest('button')) return
    const el = windowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    }
    e.preventDefault()
  }

  useEffect(() => {
    if (!draggable) return
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      // Clamp inside the window viewport so the title bar never leaves the screen
      const el = windowRef.current
      const margin = 8
      const w = el?.offsetWidth ?? 0
      const h = el?.offsetHeight ?? 0
      const maxX = window.innerWidth - Math.min(w, 200) // keep at least 200px visible
      const maxY = window.innerHeight - 50              // keep title bar visible
      const x = Math.max(-w + 200, Math.min(maxX, d.originX + dx))
      const y = Math.max(0, Math.min(maxY, d.originY + dy))
      setPos({ x, y })
      // Suppress text-selection while dragging
      if (typeof getSelection !== 'undefined') {
        const sel = getSelection()
        if (sel && !sel.isCollapsed) sel.removeAllRanges()
      }
      void h
    }
    function onUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggable])

  const chipClass = chipClassFor(data.statusColor)
  const activeTabId = stripHash(data.caseId)

  // Position style: when not draggable, no inline positioning. When draggable
  // and pos is null, center via translate. Otherwise, absolute pixel coords.
  const positionStyle: CSSProperties = !draggable
    ? {}
    : pos == null
    ? { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
    : { position: 'absolute', left: pos.x, top: pos.y, transform: 'none' }

  return (
    <>
    <div
      ref={windowRef}
      className={[
        styles.window,
        draggable ? styles.draggable : '',
        minimized ? styles.windowMinimized : '',
        className,
      ].filter(Boolean).join(' ')}
      style={positionStyle}
    >
      {/* Window head: upper bar + body row. In Figma this whole block
          has height 800px (the footer sits outside it). */}
      <div className={styles.windowHead}>
        <div className={styles.upperBar} onMouseDown={onTitleMouseDown}>
          <div className={styles.upperBarTitle}>Cases</div>
          <div className={styles.upperBarBtns}>
            <button type="button" className={`${styles.chromeBtn} ${styles.chromeExpand}`} aria-label="Expand">
              <img src={`${A}/expand.svg`} alt="" />
            </button>
            <button
              type="button"
              className={`${styles.chromeBtn} ${styles.chromeMinimize}`}
              aria-label={minimized ? 'Restore' : 'Minimize'}
              onClick={handleMinimize}
            >
              <img src={`${A}/minimize.svg`} alt="" />
            </button>
            <button
              type="button"
              className={`${styles.chromeBtn} ${styles.chromeClose}`}
              aria-label="Close"
              onClick={onClose}
            >
              <img src={`${A}/close.svg`} alt="" />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className={styles.mainRow}>
            <div className={styles.bodyRow}>

              {/* Left side tabs */}
              <div className={styles.tabs} data-spot="case.tabs">
                {tabList.map((tab) => {
                  const isActive = stripHash(tab.id) === activeTabId
                  const isLocked = !!tab.locked
                  return (
                    <button
                      type="button"
                      key={tab.id}
                      data-spot={isActive ? 'case.tab.active' : undefined}
                      className={[
                        styles.tab,
                        isActive ? styles.tabActive : '',
                        isLocked ? styles.tabLocked : '',
                      ].filter(Boolean).join(' ')}
                      disabled={isLocked}
                      aria-disabled={isLocked}
                      onClick={() => {
                        if (isLocked) return
                        onTabSelect?.(tab.id)
                      }}
                    >
                      <span className={styles.tabId}>Case #{stripHash(tab.id)}</span>
                      <span className={styles.tabTime}>{tab.time}</span>
                    </button>
                  )
                })}
                <div className={styles.tabsFiller} />
              </div>

              {/* Right side: case body */}
              <div className={styles.caseBody}>
                {/* Case header */}
                <div className={styles.caseHeader} data-spot="case.header">
                  <div className={styles.caseHeaderInner}>
                    <div className={styles.caseHeaderLeft}>
                      {editable ? (
                        <input
                          className={`${styles.editableInputInline} ${styles.caseId}`}
                          value={data.caseId}
                          onChange={(e) => set('caseId', e.target.value)}
                        />
                      ) : (
                        <p className={styles.caseId}>Case #{data.caseId}</p>
                      )}
                      {editable ? (
                        <span className={styles.caseCreated}>
                          Created on{' '}
                          <input
                            className={styles.editableInputInline}
                            value={data.createdAt}
                            onChange={(e) => set('createdAt', e.target.value)}
                          />
                        </span>
                      ) : (
                        <p className={styles.caseCreated}>Created on {data.createdAt}</p>
                      )}
                    </div>
                    {editable ? (
                      <div className={styles.headerChipsEditable}>
                        {(data.extraChips ?? []).map((c) => (
                          <span key={c.id} className={styles.rowControls}>
                            <input
                              className={styles.editableInputInline}
                              value={c.label}
                              placeholder="Chip"
                              onChange={(e) => updateExtraChip(c.id, { label: e.target.value })}
                              style={{ width: 130 }}
                            />
                            <select
                              className={styles.editableSelect}
                              value={c.color}
                              onChange={(e) => updateExtraChip(c.id, { color: e.target.value as StatusColor })}
                            >
                              <option value="green">green</option>
                              <option value="red">red</option>
                              <option value="yellow">yellow</option>
                              <option value="grey">grey</option>
                            </select>
                            <button
                              type="button"
                              className={`${styles.rowControlBtn} ${styles.rowControlBtnRemove}`}
                              onClick={() => removeExtraChip(c.id)}
                              aria-label="Remove chip"
                            >×</button>
                          </span>
                        ))}
                        <button
                          type="button"
                          className={`${styles.rowControlBtn} ${styles.rowControlBtnAdd}`}
                          onClick={addExtraChip}
                        >+ Chip</button>
                        <span className={styles.rowControls}>
                          <input
                            className={styles.editableInputInline}
                            value={data.statusLabel}
                            onChange={(e) => set('statusLabel', e.target.value)}
                            style={{ width: 90 }}
                          />
                          <select
                            className={styles.editableSelect}
                            value={data.statusColor}
                            onChange={(e) => set('statusColor', e.target.value as StatusColor)}
                          >
                            <option value="green">green</option>
                            <option value="red">red</option>
                            <option value="yellow">yellow</option>
                            <option value="grey">grey</option>
                          </select>
                        </span>
                      </div>
                    ) : (
                      <div className={styles.headerChips}>
                        {(data.extraChips ?? []).map((c) => (
                          <div key={c.id} className={`${styles.chip} ${chipClassFor(c.color)}`}>
                            {c.label}
                          </div>
                        ))}
                        <div className={`${styles.chip} ${chipClass}`}>{data.statusLabel}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.contentRow}>
                  <div className={styles.content} ref={contentRef} onScroll={updateScrollMeta}>
                    {/* Identity row */}
                    <div className={styles.identity}>
                      {/* Photo — when useCamera is on, the webcam fills the
                          photo slot in both play mode AND the editor preview
                          so the builder can confirm the toggle is wired. */}
                      {useCamera ? (
                        <div className={styles.photo} data-spot="case.photo">
                          <WebcamVisual fallbackPhotoUrl={data.photoUrl} />
                        </div>
                      ) : editable ? (
                        <label className={`${styles.photo} ${styles.photoEditWrap}`} htmlFor={photoInputId} data-spot="case.photo">
                          <PhotoVisual photoUrl={data.photoUrl} />
                          <div className={styles.photoEditOverlay}>Change photo</div>
                          <input
                            id={photoInputId}
                            type="file"
                            accept="image/*"
                            className={styles.photoFileInput}
                            onChange={onPhotoFile}
                          />
                        </label>
                      ) : (
                        <div className={styles.photo} data-spot="case.photo">
                          <PhotoVisual photoUrl={data.photoUrl} />
                        </div>
                      )}

                      {/* Details */}
                      <div className={styles.details}>
                        {editable ? (
                          <input
                            className={`${styles.editableInputInline} ${styles.editableName} ${styles.fullName}`}
                            value={data.fullName}
                            onChange={(e) => set('fullName', e.target.value)}
                          />
                        ) : (
                          <p className={styles.fullName}>{data.fullName}</p>
                        )}

                        <div className={styles.detailsGrid}>
                          <DetailRow label="ID No."     editable={editable} value={data.idNo}        onChange={(v) => set('idNo', v)} />
                          <DetailRow label="DOB"        editable={editable} value={data.dob}         onChange={(v) => set('dob', v)} />
                          <DetailRow label="Sex"        editable={editable} value={data.sex}         onChange={(v) => set('sex', v)} />
                          <DetailRow label="Nationality" editable={editable} value={data.nationality} onChange={(v) => set('nationality', v)} />
                          <DetailRow
                            label="Religion"
                            editable={editable}
                            value={data.religion}
                            valueClassName={
                              data.religionColor === 'red'   ? styles.detailValueRed   :
                              data.religionColor === 'green' ? styles.detailValueGreen :
                              undefined
                            }
                            onChange={(v) => set('religion', v)}
                            extra={editable && (
                              <select
                                className={styles.editableSelect}
                                value={data.religionColor}
                                onChange={(e) => set('religionColor', e.target.value as 'black' | 'red' | 'green')}
                                style={{ marginLeft: 8 }}
                              >
                                <option value="black">black</option>
                                <option value="red">red</option>
                                <option value="green">green</option>
                              </select>
                            )}
                          />
                          <DetailRow label="Address"    editable={editable} value={data.address}     onChange={(v) => set('address', v)} />
                        </div>
                      </div>
                    </div>

                    {/* Yellow panel: criminal record + suspicion */}
                    <div className={styles.panel}>
                      {/* Criminal record */}
                      <div className={styles.panelSection} data-spot="case.criminalRecord">
                        <p className={styles.panelTitle}>Criminal Record</p>
                        <div className={styles.recordTable}>
                          {data.criminalRecord.length === 0 ? (
                            <div className={styles.emptyRow}>
                              {editable ? (
                                <input
                                  className={`${styles.editableInputInline} ${styles.emptyRowInput}`}
                                  value={data.criminalRecordEmptyText ?? ''}
                                  placeholder="No criminal record yet."
                                  onChange={(e) => set('criminalRecordEmptyText', e.target.value)}
                                />
                              ) : (
                                <p>{data.criminalRecordEmptyText ?? 'No criminal record yet.'}</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className={styles.recordTableHeader}>
                                <span className={styles.recordHeaderSpacer} />
                                <p className={styles.recordHeader}>Subject</p>
                                <p className={styles.recordHeader}>Status</p>
                                <p className={styles.recordHeader}>Date</p>
                              </div>
                              {data.criminalRecord.map((r) => (
                                <CriminalRecordRowView
                                  key={r.id}
                                  row={r}
                                  editable={editable}
                                  expanded={expandedCrimRows.has(r.id)}
                                  onToggle={() => toggleCrimRow(r.id)}
                                  onUpdate={(patch) => updateCrim(r.id, patch)}
                                  onRemove={() => removeCrim(r.id)}
                                />
                              ))}
                            </>
                          )}
                        </div>
                        {editable && (
                          <button
                            type="button"
                            className={`${styles.rowControlBtn} ${styles.rowControlBtnAdd}`}
                            onClick={addCrim}
                          >+ Add record</button>
                        )}
                      </div>

                      {/* Suspicion */}
                      <div className={styles.panelSection} data-spot="case.suspicions">
                        <p className={styles.panelTitle}>Suspicion</p>
                        <div className={styles.recordTable}>
                          <div className={`${styles.susTableHeader} ${editable ? styles.susTableHeaderEditable : ''}`}>
                            <span className={styles.recordHeaderSpacer} />
                            <p className={styles.recordHeader}>Subject</p>
                            <p className={styles.recordHeader}>Status</p>
                            <p className={styles.recordHeader}>Date</p>
                            <p className={styles.recordHeader}>File</p>
                          </div>
                          {data.suspicions.map((s) => (
                            <SuspicionRowView
                              key={s.id}
                              row={s}
                              editable={editable}
                              expanded={expandedRows.has(s.id)}
                              onToggle={() => toggleRow(s.id)}
                              onUpdate={(patch) => updateSus(s.id, patch)}
                              onRemove={() => removeSus(s.id)}
                              onOpenFootage={setOpenFootageVariant}
                              onRowTrigger={onRowTrigger}
                            />
                          ))}
                        </div>
                        {editable && (
                          <button
                            type="button"
                            className={`${styles.rowControlBtn} ${styles.rowControlBtnAdd}`}
                            onClick={addSus}
                          >+ Add suspicion</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right scroll column — arrows step the body, the
                      track shows position and the thumb is draggable. */}
                  <div className={styles.scrollColumn}>
                    <button
                      type="button"
                      className={`${styles.scrollBtn} ${styles.scrollBtnRotateUp}`}
                      aria-label="Scroll up"
                      onClick={() => scrollByStep(-1)}
                    >
                      <img src={`${A}/arrow-forward.svg`} alt="" />
                    </button>
                    <div
                      className={styles.scrollTrack}
                      ref={trackRef}
                      onMouseDown={onTrackMouseDown}
                    >
                      {scrollMeta.visible && (
                        <div
                          className={styles.scrollThumb}
                          style={{ height: scrollMeta.thumbHeight, top: scrollMeta.thumbTop }}
                          onMouseDown={onThumbMouseDown}
                          role="scrollbar"
                          aria-orientation="vertical"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      className={`${styles.scrollBtn} ${styles.scrollBtnBottom} ${styles.scrollBtnRotateDown}`}
                      aria-label="Scroll down"
                      onClick={() => scrollByStep(1)}
                    >
                      <img src={`${A}/arrow-forward-alt.svg`} alt="" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer: in play mode flips between three variants:
            • undecided → "Make a decision" + Arrest / Release CTAs
            • arrested  → "Decision Made" + red   "Arrested" pill
            • released  → "Decision Made" + green "Released" pill
          (Edit mode always shows the editable arrest/release labels.) */}
      {!minimized && (
        <div className={styles.footer}>
          <p className={styles.footerText}>
            {editable || !decision ? 'Make a decision' : 'Decision Made'}
          </p>
          <div className={styles.ctas}>
            {editable ? (
              <>
                <input
                  className={`${styles.editableInputInline}`}
                  value={data.arrestLabel}
                  onChange={(e) => set('arrestLabel', e.target.value)}
                  style={{ width: 220 }}
                />
                <input
                  className={`${styles.editableInputInline}`}
                  value={data.releaseLabel}
                  onChange={(e) => set('releaseLabel', e.target.value)}
                  style={{ width: 220 }}
                />
              </>
            ) : decision === 'arrested' ? (
              <div className={`${styles.decisionPill} ${styles.decisionPillRed}`}>Arrested</div>
            ) : decision === 'released' ? (
              <div className={`${styles.decisionPill} ${styles.decisionPillGreen}`}>Released</div>
            ) : (
              <>
                <button type="button" data-spot="case.arrest" className={`${styles.cta} ${styles.ctaArrest}`} onClick={onArrest}>
                  {data.arrestLabel}
                </button>
                <button type="button" data-spot="case.release" className={`${styles.cta} ${styles.ctaRelease}`} onClick={onRelease}>
                  {data.releaseLabel}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Footage overlay — appears above the case window when a suspicion
        row's footage attachment is opened. Backdrop click closes. */}
    {openFootageVariant && (
      <div
        className={styles.footageOverlay}
        onClick={() => setOpenFootageVariant(null)}
      >
        <div
          className={styles.footageStage}
          onClick={(e) => e.stopPropagation()}
        >
          <FootageWindow
            data={
              openFootageVariant === 'indecent-exposure'
                ? DEFAULT_INDECENT_EXPOSURE_DATA
                : DEFAULT_FOOTAGE_DATA
            }
            variant={openFootageVariant}
            draggable
            onClose={() => setOpenFootageVariant(null)}
          />
        </div>
      </div>
    )}
    </>
  )
}

/* ─── Sub-components ─────────────────────────────── */

function PhotoVisual({ photoUrl }: { photoUrl: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={styles.photoImg} />
  }
  return <img src={`${A}/photo-default.svg`} alt="" className={styles.photoDefault} />
}

/** Live webcam feed for the photo slot. The chroma-stroke WebGL2
 *  filter (`WebcamFilter`) is intentionally bypassed for now — flip
 *  WEBCAM_FILTER_ENABLED back to `true` to re-enable it without
 *  touching anything else. Falls back to the static photo when the
 *  browser blocks the camera. */
const WEBCAM_FILTER_ENABLED = false

function WebcamVisual({ fallbackPhotoUrl }: { fallbackPhotoUrl: string }) {
  const [errored, setErrored] = useState(false)
  if (errored) return <PhotoVisual photoUrl={fallbackPhotoUrl} />
  if (WEBCAM_FILTER_ENABLED) {
    return <WebcamFilter onError={() => setErrored(true)} />
  }
  return <RawWebcamVisual onError={() => setErrored(true)} />
}

/** Plain webcam feed — no shader, no segmentation. Stops the stream
 *  on unmount so the camera light goes off when the case closes. */
function RawWebcamVisual({ onError }: { onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md || typeof md.getUserMedia !== 'function') {
      onErrorRef.current()
      return
    }
    md.getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const v = videoRef.current
        if (v) {
          v.srcObject = s
          v.play().catch(() => { /* autoplay blocked — frames still arrive */ })
        }
      })
      .catch(() => onErrorRef.current())
    return () => {
      cancelled = true
      if (stream) stream.getTracks().forEach((t) => t.stop())
      const v = videoRef.current
      if (v) v.srcObject = null
    }
  }, [])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={styles.photoImg}
      style={{ transform: 'scaleX(-1)' }}
    />
  )
}

type DetailRowProps = {
  label: string
  value: string
  editable: boolean
  onChange: (v: string) => void
  valueClassName?: string
  extra?: React.ReactNode
}

function DetailRow({ label, value, editable, onChange, valueClassName, extra }: DetailRowProps) {
  return (
    <>
      <span className={styles.detailLabel}>{label}</span>
      <span className={[styles.detailValue, valueClassName].filter(Boolean).join(' ')}>
        {editable ? (
          <input
            className={`${styles.editableInputInline} ${styles.editableValue}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          value
        )}
        {extra}
      </span>
    </>
  )
}

type CriminalRecordRowViewProps = {
  row: CriminalRecordRow
  editable: boolean
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<CriminalRecordRow>) => void
  onRemove: () => void
}

/** Single criminal record row — card layout with expandable details body. */
function CriminalRecordRowView({
  row, editable, expanded, onToggle, onUpdate, onRemove,
}: CriminalRecordRowViewProps) {
  const statusColor: StatusColor = row.statusColor ?? 'red'
  const statusChipClass = chipClassFor(statusColor)
  const date = row.date ?? ''
  const status = row.status ?? ''
  const details = row.details ?? ''
  const hasDetails = details.trim().length > 0 || editable

  return (
    <div className={`${styles.recordRow} ${expanded ? styles.recordRowOpen : ''}`}>
      <div className={`${styles.recordRowMain} ${editable ? styles.recordRowMainEditable : ''}`}>
        <button
          type="button"
          className={`${styles.recordExpandBtn} ${expanded ? styles.recordExpandBtnOpen : ''}`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          onClick={onToggle}
          disabled={!hasDetails && !editable}
        >
          <img src={`${A}/arrow-down.svg`} alt="" />
        </button>

        {editable ? (
          <input
            className={`${styles.editableInputInline} ${styles.recordSubjectInput}`}
            placeholder="Subject"
            value={row.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
          />
        ) : (
          <button type="button" className={styles.recordSubject} onClick={onToggle}>
            {row.text}
          </button>
        )}

        {editable ? (
          <span className={styles.rowControls}>
            <input
              className={styles.editableInputInline}
              placeholder="Status"
              value={status}
              onChange={(e) => onUpdate({ status: e.target.value })}
              style={{ width: 100 }}
            />
            <select
              className={styles.editableSelect}
              value={statusColor}
              onChange={(e) => onUpdate({ statusColor: e.target.value as StatusColor })}
            >
              <option value="green">green</option>
              <option value="red">red</option>
              <option value="yellow">yellow</option>
              <option value="grey">grey</option>
            </select>
          </span>
        ) : (
          status ? <div className={`${styles.chip} ${statusChipClass}`}>{status}</div> : <span />
        )}

        {editable ? (
          <input
            className={styles.editableInputInline}
            placeholder="Date"
            value={date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            style={{ width: 130 }}
          />
        ) : (
          <p className={styles.recordDate}>{date}</p>
        )}

        {editable && (
          <button
            type="button"
            className={`${styles.rowControlBtn} ${styles.rowControlBtnRemove}`}
            onClick={onRemove}
          >×</button>
        )}
      </div>

      {expanded && (
        <div className={styles.recordDetails}>
          {editable ? (
            <textarea
              className={styles.susDetailsTextarea}
              value={details}
              placeholder="Body text — use **bold** for emphasis."
              onChange={(e) => onUpdate({ details: e.target.value })}
            />
          ) : (
            <DetailsBody text={details} />
          )}
        </div>
      )}
    </div>
  )
}

type SuspicionRowViewProps = {
  row: SuspicionRow
  editable: boolean
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<SuspicionRow>) => void
  onRemove: () => void
  /** Called when the attachment is a Footage variant and the user clicks
   *  the file icon — parent renders the FootageWindow overlay. */
  onOpenFootage: (variant: FootageVariant) => void
  /** Play-mode wrapper. If provided, the row's click runs through the
   *  trigger lookup (graph Trigger nodes) before invoking the action. */
  onRowTrigger?: (
    action: 'expand' | 'attachment',
    rowId: string,
    thenRun: () => void,
  ) => void
}

function SuspicionRowView({
  row, editable, expanded, onToggle, onUpdate, onRemove, onOpenFootage,
  onRowTrigger,
}: SuspicionRowViewProps) {
  const statusChipClass = chipClassFor(row.statusColor)
  const footageVariant = row.fileFootageVariant ?? ''

  // Play-mode click wrappers. The graph-based trigger lookup happens
  // inside `onRowTrigger` (provided by GamePage); the editor preview /
  // standalone mode just runs the action directly.
  function fireExpand() {
    if (onRowTrigger) onRowTrigger('expand', row.id, onToggle)
    else onToggle()
  }
  function fireFootage(variant: FootageVariant) {
    const action = () => onOpenFootage(variant)
    if (onRowTrigger) onRowTrigger('attachment', row.id, action)
    else action()
  }

  return (
    <div className={`${styles.recordRow} ${expanded ? styles.recordRowOpen : ''}`} data-spot="case.suspicion.row">
      <div className={`${styles.susRowMain} ${editable ? styles.susRowMainEditable : ''}`}>
        <button
          type="button"
          className={`${styles.recordExpandBtn} ${expanded ? styles.recordExpandBtnOpen : ''}`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          onClick={fireExpand}
        >
          <img src={`${A}/arrow-down.svg`} alt="" />
        </button>

        {editable ? (
          <input
            className={`${styles.editableInputInline} ${styles.recordSubjectInput}`}
            value={row.subject}
            onChange={(e) => onUpdate({ subject: e.target.value })}
          />
        ) : (
          <button type="button" className={styles.recordSubject} onClick={fireExpand}>
            {row.subject}
          </button>
        )}

        {editable ? (
          <span className={styles.rowControls}>
            <input
              className={styles.editableInputInline}
              value={row.status}
              onChange={(e) => onUpdate({ status: e.target.value })}
              style={{ width: 80 }}
            />
            <select
              className={styles.editableSelect}
              value={row.statusColor}
              onChange={(e) => onUpdate({ statusColor: e.target.value as StatusColor })}
            >
              <option value="green">green</option>
              <option value="red">red</option>
              <option value="yellow">yellow</option>
              <option value="grey">grey</option>
            </select>
          </span>
        ) : (
          <div className={`${styles.chip} ${statusChipClass}`}>{row.status}</div>
        )}

        {editable ? (
          <input
            className={styles.editableInputInline}
            value={row.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            style={{ width: 110 }}
          />
        ) : (
          <p className={styles.recordDate}>{row.date}</p>
        )}

        {editable ? (
          <span className={styles.rowControls}>
            <select
              className={styles.editableSelect}
              value={footageVariant}
              onChange={(e) => {
                const v = e.target.value
                onUpdate({ fileFootageVariant: v === '' ? undefined : (v as FootageVariant) })
              }}
              title="Footage attachment"
              style={{ width: 110 }}
            >
              <option value="">No footage</option>
              <option value="graffiti">Footage: Graffiti</option>
              <option value="graffiti-video">Footage: Graffiti (video)</option>
              <option value="jewish-violence">Footage: Jewish violence</option>
              <option value="indecent-exposure">Footage: Indecent exposure</option>
            </select>
            <input
              className={styles.editableAttachUrl}
              placeholder="or file URL"
              value={row.fileUrl}
              onChange={(e) => onUpdate({ fileUrl: e.target.value })}
            />
            <button
              type="button"
              className={`${styles.rowControlBtn} ${styles.rowControlBtnRemove}`}
              onClick={onRemove}
            >×</button>
          </span>
        ) : row.fileFootageVariant ? (
          <button
            type="button"
            data-spot="case.suspicion.attachment"
            className={styles.attachBtn}
            aria-label="Open footage"
            onClick={() => fireFootage(row.fileFootageVariant as FootageVariant)}
          >
            <img src={`${A}/attachment.svg`} alt="" />
          </button>
        ) : row.fileUrl ? (
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer"
            data-spot="case.suspicion.attachment"
            className={styles.attachBtn}
            aria-label="Open attachment"
          >
            <img src={`${A}/attachment.svg`} alt="" />
          </a>
        ) : (
          <span className={`${styles.attachBtn} ${styles.attachBtnDisabled}`} aria-label="No attachment">
            <img src={`${A}/attachment.svg`} alt="" />
          </span>
        )}
      </div>

      {expanded && (
        <div className={styles.recordDetails}>
          {editable ? (
            <textarea
              className={styles.susDetailsTextarea}
              value={row.details}
              placeholder="Body text — use **bold** for emphasis."
              onChange={(e) => onUpdate({ details: e.target.value })}
            />
          ) : (
            <DetailsBody text={row.details} />
          )}
        </div>
      )}
    </div>
  )
}

/** Renders the suspicion details body with **bold** support and line breaks. */
function DetailsBody({ text }: { text: string }) {
  if (!text) return null
  const paragraphs = text.split(/\n{2,}/g)
  return (
    <div>
      {paragraphs.map((para, i) => (
        <p key={i} className={styles.susDetailsParagraph}>
          {renderInline(para)}
        </p>
      ))}
    </div>
  )
}

/** Splits a string on `**...**` and returns <strong> nodes for those parts. */
function renderInline(s: string): ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>
    }
    // Preserve single line breaks within a paragraph
    const lines = p.split('\n')
    return lines.map((ln, j) => (
      <span key={`${i}-${j}`}>
        {ln}
        {j < lines.length - 1 ? <br /> : null}
      </span>
    ))
  })
}

function chipClassFor(color: StatusColor): string {
  switch (color) {
    case 'red':    return styles.chipRed
    case 'yellow': return styles.chipYellow
    case 'grey':   return styles.chipGrey
    case 'green':
    default:       return styles.chipGreen
  }
}

function stripHash(s: string): string {
  return s.replace(/^#/, '').replace(/^0+/, '') || s
}
