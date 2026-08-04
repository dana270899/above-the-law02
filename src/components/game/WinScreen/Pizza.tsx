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
const BURP_SOUND_SRC = assetUrl('/sounds/Burp.mp3')
const DEFAULT_WIN_TITLE = 'Win'
const DEFAULT_WIN_FOOTER_TEXT = 'Winning is so good'
const DEFAULT_WIN_CTA_LABEL = 'Love this job, next case!'
const DESIGN_WIDTH = 1440
const DESIGN_HEIGHT = 810
const CAR_SCALE = 0.9
const CAR_ORIGINAL_WIDTH = 658
const CAR_ORIGINAL_HEIGHT = 299
const CAR_ORIGINAL_Y = 443
const CAR_ORIGINAL_START_X = 704
const CAR_WIDTH = CAR_ORIGINAL_WIDTH * CAR_SCALE
const CAR_HEIGHT = CAR_ORIGINAL_HEIGHT * CAR_SCALE
const CAR_Y = CAR_ORIGINAL_Y + (CAR_ORIGINAL_HEIGHT - CAR_HEIGHT) / 2
const CAR_START_X = CAR_ORIGINAL_START_X + (CAR_ORIGINAL_WIDTH - CAR_WIDTH) / 2
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

export interface PizzaProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  debug?: boolean
  muteAudio?: boolean
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
  muteAudio = false,
}: PizzaProps = {}) {
  const { src: bgSrc, label, handleError } = useWinScreenBackground({
    variant: 'pizza',
    src: srcOverride,
    blobId,
  })
  const [carX, setCarX] = useState(CAR_START_X)
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([])
  const [carFeedback, setCarFeedback] = useState<'collect' | 'hit' | null>(null)
  const screenRef = useRef<HTMLDivElement | null>(null)
  const carXRef = useRef(CAR_START_X)
  const fallingItemsRef = useRef<FallingItem[]>([])
  const nextItemIdRef = useRef(0)
  const scoreRef = useRef(0)
  const hitsRef = useRef(0)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const burpAudioRef = useRef<HTMLAudioElement | null>(null)

  function playBurpSound() {
    if (muteAudio) return
    const source = burpAudioRef.current
    const audio = source ? source.cloneNode(true) as HTMLAudioElement : new Audio(BURP_SOUND_SRC)
    audio.play().catch(() => { /* Audio may be blocked before a user gesture. */ })
  }

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
    }, type === 'hit' ? 360 : 220)
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

  function followPointer(e: PointerEvent<HTMLDivElement>) {
    setLiveCarX(screenClientXToDesignX(e.clientX) - CAR_WIDTH / 2)
  }

  useEffect(() => {
    if (!muteAudio) {
      const burpAudio = new Audio(BURP_SOUND_SRC)
      burpAudio.preload = 'auto'
      burpAudio.load()
      burpAudioRef.current = burpAudio
    }

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
        left: carXRef.current + 70 * CAR_SCALE,
        right: carXRef.current + CAR_WIDTH - 54 * CAR_SCALE,
        top: CAR_Y + 42 * CAR_SCALE,
        bottom: CAR_Y + CAR_HEIGHT - 18 * CAR_SCALE,
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
            playBurpSound()
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
      }
      if (nextHits !== hitsRef.current) {
        hitsRef.current = nextHits
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
      burpAudioRef.current = null
    }
  }, [muteAudio])

  const carStyle = {
    '--car-x': `${carX}px`,
    '--car-y': `${CAR_Y}px`,
    '--car-width': `${CAR_WIDTH}px`,
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
      <div
        className={styles.screen}
        ref={screenRef}
        data-win-content
        onPointerMove={followPointer}
      >
        <img
          className={styles.windowBg}
          src={bgSrc}
          alt={label}
          draggable={false}
          onError={handleError}
        />
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
        <div
          className={[
            styles.police,
            carFeedback === 'collect' ? styles.policeCollect : '',
            carFeedback === 'hit' ? styles.policeHit : '',
          ].filter(Boolean).join(' ')}
          style={carStyle}
        >
          <img
            className={styles.policeArt}
            src={POLICE_SRC}
            alt=""
            draggable={false}
          />
        </div>
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
}
