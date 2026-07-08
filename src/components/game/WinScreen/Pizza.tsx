import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { assetUrl } from '@/lib/paths'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './Pizza.module.css'

const ASSET_ROOT = assetUrl('/images/win-screens/Pizza')
const FIGHT_SRC = `${ASSET_ROOT}/Fight.svg`
const PIZZA_SRC = `${ASSET_ROOT}/Pizza.svg`
const POLICE_SRC = `${ASSET_ROOT}/Police.svg`
const DEFAULT_WIN_TITLE = 'Win'
const DEFAULT_WIN_FOOTER_TEXT = 'Winning is so good'
const DEFAULT_WIN_CTA_LABEL = 'Love this job, next case!'
const DESIGN_WIDTH = 1440
const DESIGN_HEIGHT = 810
const CAR_WIDTH = 658
const CAR_HEIGHT = 299
const CAR_Y = 443
const CAR_START_X = 704
const PIZZA_SIZE = 122
const FIGHT_SIZE = 158
const SPAWN_MIN_MS = 520
const SPAWN_MAX_MS = 980

type FallingKind = 'pizza' | 'fight'

interface FallingItem {
  id: number
  kind: FallingKind
  x: number
  y: number
  size: number
  speed: number
  rotation: number
  spin: number
}

type DragState = {
  pointerId: number
  pointerOffsetX: number
}

export interface PizzaProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  debug?: boolean
}

export function Pizza({
  className,
  src: srcOverride,
  blobId,
  onComplete,
  winTitle = DEFAULT_WIN_TITLE,
  winFooterText = DEFAULT_WIN_FOOTER_TEXT,
  winCtaLabel = DEFAULT_WIN_CTA_LABEL,
  debug = false,
}: PizzaProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'pizza',
    src: srcOverride,
    blobId,
  })
  const [carX, setCarX] = useState(CAR_START_X)
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([])
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [carFeedback, setCarFeedback] = useState<'collect' | 'hit' | null>(null)
  const screenRef = useRef<HTMLDivElement | null>(null)
  const carXRef = useRef(CAR_START_X)
  const fallingItemsRef = useRef<FallingItem[]>([])
  const dragRef = useRef<DragState | null>(null)
  const nextItemIdRef = useRef(0)
  const scoreRef = useRef(0)
  const hitsRef = useRef(0)
  const feedbackTimeoutRef = useRef<number | null>(null)

  function setLiveCarX(nextX: number) {
    const clampedX = Math.max(0, Math.min(DESIGN_WIDTH - CAR_WIDTH, nextX))
    carXRef.current = clampedX
    setCarX(clampedX)
  }

  function screenClientXToDesignX(clientX: number) {
    const rect = screenRef.current?.getBoundingClientRect()
    if (!rect) return carXRef.current
    return ((clientX - rect.left) / rect.width) * DESIGN_WIDTH
  }

  function triggerCarFeedback(type: 'collect' | 'hit') {
    setCarFeedback(type)
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current)
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setCarFeedback(null)
      feedbackTimeoutRef.current = null
    }, 220)
  }

  function spawnItem(): FallingItem {
    const kind: FallingKind = Math.random() < 0.58 ? 'pizza' : 'fight'
    const size = kind === 'pizza' ? PIZZA_SIZE : FIGHT_SIZE
    return {
      id: nextItemIdRef.current++,
      kind,
      x: Math.random() * (DESIGN_WIDTH - size),
      y: -size - Math.random() * 120,
      size,
      speed: kind === 'pizza' ? 185 + Math.random() * 105 : 225 + Math.random() * 135,
      rotation: Math.random() * 50 - 25,
      spin: (Math.random() * 42 + 18) * (Math.random() < 0.5 ? -1 : 1),
    }
  }

  function startCarDrag(e: PointerEvent<HTMLImageElement>) {
    e.preventDefault()
    e.stopPropagation()
    const designX = screenClientXToDesignX(e.clientX)
    dragRef.current = {
      pointerId: e.pointerId,
      pointerOffsetX: designX - carXRef.current,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  useEffect(() => {
    function onPointerMove(e: globalThis.PointerEvent) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const designX = screenClientXToDesignX(e.clientX)
      setLiveCarX(designX - drag.pointerOffsetX)
    }

    function onPointerUp(e: globalThis.PointerEvent) {
      if (dragRef.current?.pointerId !== e.pointerId) return
      dragRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      dragRef.current = null
    }
  }, [])

  useEffect(() => {
    let rafId = 0
    let lastTime = performance.now()
    let nextSpawnAt = lastTime + 220

    function tick(now: number) {
      const dt = Math.min(0.034, (now - lastTime) / 1000)
      lastTime = now
      let items = fallingItemsRef.current

      if (now >= nextSpawnAt) {
        items = [...items, spawnItem()]
        nextSpawnAt =
          now + SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS)
      }

      const carRect = {
        left: carXRef.current + 70,
        right: carXRef.current + CAR_WIDTH - 54,
        top: CAR_Y + 42,
        bottom: CAR_Y + CAR_HEIGHT - 18,
      }
      let nextScore = scoreRef.current
      let nextHits = hitsRef.current
      let feedback: 'collect' | 'hit' | null = null

      const nextItems: FallingItem[] = []
      for (const item of items) {
        const nextItem = {
          ...item,
          y: item.y + item.speed * dt,
          rotation: item.rotation + item.spin * dt,
        }
        const itemRect = {
          left: nextItem.x + nextItem.size * 0.18,
          right: nextItem.x + nextItem.size * 0.82,
          top: nextItem.y + nextItem.size * 0.16,
          bottom: nextItem.y + nextItem.size * 0.86,
        }
        const collides =
          itemRect.right >= carRect.left &&
          itemRect.left <= carRect.right &&
          itemRect.bottom >= carRect.top &&
          itemRect.top <= carRect.bottom

        if (collides) {
          if (nextItem.kind === 'pizza') {
            nextScore += 1
            feedback = 'collect'
          } else {
            nextHits += 1
            feedback = 'hit'
          }
          continue
        }

        if (nextItem.y < DESIGN_HEIGHT + nextItem.size) {
          nextItems.push(nextItem)
        }
      }

      if (nextScore !== scoreRef.current) {
        scoreRef.current = nextScore
        setScore(nextScore)
      }
      if (nextHits !== hitsRef.current) {
        hitsRef.current = nextHits
        setHits(nextHits)
      }
      if (feedback) triggerCarFeedback(feedback)

      fallingItemsRef.current = nextItems
      setFallingItems(nextItems)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [])

  const carStyle = {
    '--car-x': `${carX}px`,
  } as CSSProperties

  return (
    <div
      className={[
        styles.window,
        className,
        debug ? styles.debug : '',
      ].filter(Boolean).join(' ')}
      data-node="win-pizza"
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
        <div className={styles.hud} aria-label={`Pizzas ${score}, fights ${hits}`}>
          <span className={styles.hudItem}>
            <img src={PIZZA_SRC} alt="" draggable={false} />
            {score}
          </span>
          <span className={styles.hudItem}>
            <img src={FIGHT_SRC} alt="" draggable={false} />
            {hits}
          </span>
        </div>
        {fallingItems.map((item) => {
          const style = {
            '--item-x': `${item.x}px`,
            '--item-y': `${item.y}px`,
            '--item-size': `${item.size}px`,
            '--item-rotation': `${item.rotation}deg`,
          } as CSSProperties
          return (
            <img
              key={item.id}
              className={[
                styles.fallingItem,
                item.kind === 'pizza' ? styles.fallingPizza : styles.fallingFight,
              ].join(' ')}
              src={item.kind === 'pizza' ? PIZZA_SRC : FIGHT_SRC}
              alt=""
              draggable={false}
              style={style}
            />
          )
        })}
        <img
          className={[
            styles.police,
            carFeedback === 'collect' ? styles.policeCollect : '',
            carFeedback === 'hit' ? styles.policeHit : '',
          ].filter(Boolean).join(' ')}
          src={POLICE_SRC}
          alt=""
          draggable={false}
          style={carStyle}
          onPointerDown={startCarDrag}
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
