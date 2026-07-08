import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { assetUrl } from '@/lib/paths'
import { startDragCursor, stopDragCursor } from '@/lib/dragCursor'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './Picnic.module.css'

const ASSET_ROOT = assetUrl('/images/win-screens/Picnic')
const PICNIC_BAG_SRC = `${ASSET_ROOT}/PicnicBag.svg`
const DEFAULT_WIN_TITLE = 'Win'
const DEFAULT_WIN_FOOTER_TEXT = 'Winning is so good'
const DEFAULT_WIN_CTA_LABEL = 'Love this job, next case!'
const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

type PicnicItemId = 'wine' | 'bread' | 'pesto' | 'glass01' | 'glass02' | 'weapon'

type PicnicItemConfig = {
  id: PicnicItemId
  label: string
  src: string
  width: number
  height: number
  startX: number
  startY: number
}

type PicnicItemState = PicnicItemConfig & {
  x: number
  y: number
  isPlaced: boolean
  isDragging: boolean
  isReturning: boolean
}

type DragState = {
  id: PicnicItemId
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  scale: number
}

const BLANKET_DROP_ZONE = {
  left: 593,
  top: 420,
  right: 1331,
  bottom: 789,
}
const DROP_TOUCH_INSET = 18

const PICNIC_ITEMS: PicnicItemConfig[] = [
  {
    id: 'glass01',
    label: 'Glass',
    src: `${ASSET_ROOT}/Glass01.svg`,
    width: 77,
    height: 201,
    startX: 706,
    startY: 690,
  },
  {
    id: 'bread',
    label: 'Bread',
    src: `${ASSET_ROOT}/Bread.svg`,
    width: 111,
    height: 398,
    startX: 831,
    startY: 613,
  },
  {
    id: 'wine',
    label: 'Wine',
    src: `${ASSET_ROOT}/Wine.svg`,
    width: 107,
    height: 351,
    startX: 937,
    startY: 571,
  },
  {
    id: 'glass02',
    label: 'Glass',
    src: `${ASSET_ROOT}/Glass02.svg`,
    width: 77,
    height: 201,
    startX: 790,
    startY: 688,
  },
  {
    id: 'pesto',
    label: 'Pesto',
    src: `${ASSET_ROOT}/Pesto.svg`,
    width: 131,
    height: 137,
    startX: 1069,
    startY: 728,
  },
  {
    id: 'weapon',
    label: 'Picnic item',
    src: `${ASSET_ROOT}/Weapon.svg`,
    width: 229,
    height: 130,
    startX: 934,
    startY: 716,
  },
]

export interface PicnicProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  debug?: boolean
}

function createInitialItems(): PicnicItemState[] {
  return PICNIC_ITEMS.map((item) => ({
    ...item,
    x: item.startX,
    y: item.startY,
    isPlaced: false,
    isDragging: false,
    isReturning: false,
  }))
}

export function Picnic({
  className,
  src: srcOverride,
  blobId,
  onComplete,
  winTitle = DEFAULT_WIN_TITLE,
  winFooterText = DEFAULT_WIN_FOOTER_TEXT,
  winCtaLabel = DEFAULT_WIN_CTA_LABEL,
  debug = false,
}: PicnicProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'picnic',
    src: srcOverride,
    blobId,
  })
  const [items, setItems] = useState<PicnicItemState[]>(createInitialItems)
  const screenRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<PicnicItemState[]>(items)
  const dragRef = useRef<DragState | null>(null)
  const dragCursorActiveRef = useRef(false)
  const returnTimeoutsRef = useRef<Record<string, number>>({})

  function releaseDragCursor() {
    if (!dragCursorActiveRef.current) return
    dragCursorActiveRef.current = false
    stopDragCursor()
  }

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    function onPointerMove(e: globalThis.PointerEvent) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const nextX = drag.startX + (e.clientX - drag.startClientX) / drag.scale
      const nextY = drag.startY + (e.clientY - drag.startClientY) / drag.scale
      setItems((current) =>
        current.map((item) =>
          item.id === drag.id
            ? {
                ...item,
                x: Math.max(0, Math.min(DESIGN_WIDTH - item.width, nextX)),
                y: Math.max(0, Math.min(DESIGN_HEIGHT - item.height, nextY)),
              }
            : item,
        ),
      )
    }

    function onPointerUp(e: globalThis.PointerEvent) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      releaseDragCursor()
      const item = itemsRef.current.find((candidate) => candidate.id === drag.id)
      if (!item) return
      const itemRect = {
        left: item.x + DROP_TOUCH_INSET,
        top: item.y + DROP_TOUCH_INSET,
        right: item.x + item.width - DROP_TOUCH_INSET,
        bottom: item.y + item.height - DROP_TOUCH_INSET,
      }
      const isOnBlanket =
        itemRect.right >= BLANKET_DROP_ZONE.left &&
        itemRect.left <= BLANKET_DROP_ZONE.right &&
        itemRect.bottom >= BLANKET_DROP_ZONE.top &&
        itemRect.top <= BLANKET_DROP_ZONE.bottom

      if (isOnBlanket) {
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === drag.id
              ? { ...candidate, isDragging: false, isPlaced: true, isReturning: false }
              : candidate,
          ),
        )
        return
      }

      setItems((current) =>
        current.map((candidate) =>
          candidate.id === drag.id
            ? {
                ...candidate,
                x: candidate.startX,
                y: candidate.startY,
                isDragging: false,
                isPlaced: false,
                isReturning: true,
              }
            : candidate,
        ),
      )
      const existingTimeout = returnTimeoutsRef.current[drag.id]
      if (existingTimeout) window.clearTimeout(existingTimeout)
      returnTimeoutsRef.current[drag.id] = window.setTimeout(() => {
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === drag.id
              ? { ...candidate, isReturning: false }
              : candidate,
          ),
        )
        delete returnTimeoutsRef.current[drag.id]
      }, 320)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      dragRef.current = null
      releaseDragCursor()
      Object.values(returnTimeoutsRef.current).forEach((timeout) => {
        window.clearTimeout(timeout)
      })
      returnTimeoutsRef.current = {}
    }
  }, [])

  function startItemDrag(e: PointerEvent<HTMLImageElement>, id: PicnicItemId) {
    e.preventDefault()
    e.stopPropagation()
    const screenElement = screenRef.current
    const screenRect = screenElement?.getBoundingClientRect()
    const item = itemsRef.current.find((candidate) => candidate.id === id)
    if (!screenElement || !screenRect || !item) return
    const scale = screenRect.width / DESIGN_WIDTH || 1
    const existingTimeout = returnTimeoutsRef.current[id]
    if (existingTimeout) {
      window.clearTimeout(existingTimeout)
      delete returnTimeoutsRef.current[id]
    }
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: item.x,
      startY: item.y,
      scale,
    }
    startDragCursor()
    dragCursorActiveRef.current = true
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, isDragging: true, isReturning: false }
          : candidate,
      ),
    )
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  return (
    <div
      className={[
        styles.window,
        className,
        debug ? styles.debug : '',
      ].filter(Boolean).join(' ')}
      data-node="win-picnic"
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
      <div className={styles.screen} ref={screenRef} data-win-content>
        <img
          className={styles.windowBg}
          src={bgSrc}
          alt={label}
          draggable={false}
          onError={handleError}
        />
        {debug && <div className={styles.dropZone} />}
        <div className={styles.itemLayer}>
          {items.map((item) => {
            const itemStyle = {
              '--item-x': `${item.x}px`,
              '--item-y': `${item.y}px`,
              '--item-width': `${item.width}px`,
              '--item-height': `${item.height}px`,
            } as CSSProperties
            return (
              <img
                key={item.id}
                className={[
                  styles.picnicItem,
                  item.isPlaced ? styles.picnicItemPlaced : '',
                  item.isDragging ? styles.picnicItemDragging : '',
                  item.isReturning ? styles.picnicItemReturning : '',
                ].filter(Boolean).join(' ')}
                src={item.src}
                alt={item.label}
                draggable={false}
                style={itemStyle}
                onPointerDown={(e) => startItemDrag(e, item.id)}
              />
            )
          })}
        </div>
        <img
          className={styles.picnicBag}
          src={PICNIC_BAG_SRC}
          alt=""
          draggable={false}
        />
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
          {winCtaLabel}
        </button>
      </div>
    </div>
  )
}
