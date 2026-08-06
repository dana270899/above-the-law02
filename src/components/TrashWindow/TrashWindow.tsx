import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { startDragCursor, stopDragCursor } from '@/lib/dragCursor'
import { assetUrl } from '@/lib/paths'
import styles from './TrashWindow.module.css'

const CASE_ICONS = assetUrl('/images/case-window')
const DESKTOP_ASSETS = assetUrl('/images/desktop')
const CROCODILE_PHOTO = assetUrl('/images/desktop/Trash/Crocodile photo - s.svg')
const CROCODILE_PHOTO_FULL = assetUrl('/images/desktop/Trash/Crocodile photo.svg')

const TRASHED_CASES = [
  'sexual_assault #19324.case',
  'sexual_assault #88324.case',
  'arab_murder_#887824.case',
]

export type TrashWindowProps = {
  onClose?: () => void
  onMinimize?: () => void
  draggable?: boolean
  className?: string
}

export function TrashWindow({
  onClose,
  onMinimize,
  draggable = false,
  className,
}: TrashWindowProps) {
  const [photoOpen, setPhotoOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [photoPos, setPhotoPos] = useState<{ x: number; y: number } | null>(null)
  const windowRef = useRef<HTMLDivElement | null>(null)
  const photoWindowRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const photoDragRef = useRef<{
    startX: number
    startY: number
    originLeft: number
    originTop: number
  } | null>(null)

  function onTitleMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (!draggable) return
    if ((e.target as HTMLElement).closest('button')) return
    const element = windowRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    }
    startDragCursor()
    e.preventDefault()
  }

  useEffect(() => {
    if (!draggable) return
    function onMove(e: MouseEvent) {
      const drag = dragRef.current
      const element = windowRef.current
      if (!drag || !element) return
      const width = element.offsetWidth
      const x = Math.max(
        -width + 200,
        Math.min(window.innerWidth - Math.min(width, 200), drag.originX + e.clientX - drag.startX),
      )
      const y = Math.max(0, Math.min(window.innerHeight - 50, drag.originY + e.clientY - drag.startY))
      setPos({ x, y })
    }
    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      stopDragCursor()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragRef.current) {
        dragRef.current = null
        stopDragCursor()
      }
    }
  }, [draggable])

  function onPhotoTitleMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    const element = photoWindowRef.current
    const parent = windowRef.current
    if (!element || !parent) return
    const rect = element.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const scaleX = parentRect.width / parent.offsetWidth
    const scaleY = parentRect.height / parent.offsetHeight
    photoDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: (rect.left - parentRect.left) / scaleX,
      originTop: (rect.top - parentRect.top) / scaleY,
    }
    startDragCursor()
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = photoDragRef.current
      const element = photoWindowRef.current
      const parent = windowRef.current
      if (!drag || !element || !parent) return
      const parentRect = parent.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const scaleX = parentRect.width / parent.offsetWidth
      const scaleY = parentRect.height / parent.offsetHeight
      const requestedLeft = parentRect.left
        + drag.originLeft * scaleX
        + e.clientX - drag.startX
      const requestedTop = parentRect.top
        + drag.originTop * scaleY
        + e.clientY - drag.startY
      const width = elementRect.width
      const left = Math.max(-width + 120, Math.min(window.innerWidth - 120, requestedLeft))
      const top = Math.max(0, Math.min(window.innerHeight - 40, requestedTop))
      setPhotoPos({
        x: (left - parentRect.left) / scaleX,
        y: (top - parentRect.top) / scaleY,
      })
    }
    function onUp() {
      if (!photoDragRef.current) return
      photoDragRef.current = null
      stopDragCursor()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (photoDragRef.current) {
        photoDragRef.current = null
        stopDragCursor()
      }
    }
  }, [])

  const positionStyle: CSSProperties = !draggable
    ? {}
    : pos
      ? { position: 'absolute', left: pos.x, top: pos.y, transform: 'none' }
      : { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div
      ref={windowRef}
      className={[
        styles.window,
        draggable ? styles.draggable : '',
        className,
      ].filter(Boolean).join(' ')}
      style={positionStyle}
    >
      <div className={styles.windowSurface}>
        <div className={styles.upperBar} onMouseDown={onTitleMouseDown}>
          <span className={styles.title}>Trash</span>
          <div className={styles.controls}>
            <button
              type="button"
              className={`${styles.control} ${styles.minimize}`}
              aria-label="Minimize"
              onClick={onMinimize}
            >
              <img src={`${CASE_ICONS}/minimize.svg`} alt="" />
            </button>
            <button
              type="button"
              className={`${styles.control} ${styles.close}`}
              aria-label="Close"
              onClick={onClose}
            >
              <img src={`${CASE_ICONS}/close.svg`} alt="" />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {TRASHED_CASES.map((fileName) => (
            <div className={styles.caseFile} key={fileName}>
              <img
                className={styles.caseIcon}
                src={`${DESKTOP_ASSETS}/Cases_Illustration.svg`}
                alt=""
              />
              <span className={styles.fileName}>{fileName}</span>
            </div>
          ))}
          <button
            type="button"
            className={`${styles.caseFile} ${styles.photoFile}`}
            aria-label="Open shabat-shalom.png"
            onClick={() => setPhotoOpen(true)}
          >
            <span className={styles.photoIconSlot}>
              <img
                className={styles.trashPhoto}
                src={CROCODILE_PHOTO}
                alt=""
              />
            </span>
            <span className={styles.fileName}>shabat-shalom.png</span>
          </button>
        </div>
      </div>

      {photoOpen && (
        <section
          ref={photoWindowRef}
          className={styles.photoWindow}
          style={photoPos
            ? { left: photoPos.x, top: photoPos.y, transform: 'none' }
            : undefined}
          role="dialog"
          aria-modal="true"
          aria-label="shabat-shalom.png"
        >
          <div className={styles.photoWindowSurface}>
            <div className={styles.photoWindowBar} onMouseDown={onPhotoTitleMouseDown}>
              <span>shabat-shalom.png</span>
              <button
                type="button"
                className={styles.photoWindowClose}
                aria-label="Close image"
                onClick={() => setPhotoOpen(false)}
              >
                <img src={`${CASE_ICONS}/close.svg`} alt="" />
              </button>
            </div>
            <img
              className={styles.fullPhoto}
              src={CROCODILE_PHOTO_FULL}
              alt="Shabat Shalom crocodiles"
            />
          </div>
        </section>
      )}
    </div>
  )
}
