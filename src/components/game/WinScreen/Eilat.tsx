import { animate, motion, useMotionValue } from 'framer-motion'
import { PointerEvent, useEffect, useRef } from 'react'
import { assetUrl } from '@/lib/paths'
import { useWinScreenBackground } from './useWinScreenBackground'
import styles from './Eilat.module.css'

const ASSET_ROOT = assetUrl('/images/win-screens/Eilat')
const PLASTIC_HIT_SOUNDS = [
  assetUrl('/sounds/Platic01.mp3'),
  assetUrl('/sounds/Platic02.mp3'),
  assetUrl('/sounds/Platic03.mp3'),
]

// Outer silhouette sampled from chair.svg. Unlike its export rectangle, this
// polygon excludes the large transparent margins around the artwork.
const CHAIR_COLLISION_SHAPE = [
  [448, 156], [525, 175], [615, 260], [683, 450], [765, 664],
  [738, 685], [667, 514], [654, 508], [309, 612], [344, 793],
  [316, 811], [226, 495], [252, 580], [205, 424], [203, 386],
  [227, 266], [281, 207],
] as const

type Point = { x: number; y: number }

const rotatePoint = (point: Point, pivot: Point, degrees: number): Point => {
  const radians = degrees * (Math.PI / 180)
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = point.x - pivot.x
  const y = point.y - pivot.y
  return {
    x: pivot.x + x * cosine - y * sine,
    y: pivot.y + x * sine + y * cosine,
  }
}

const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const onSegment = (p: Point, q: Point, r: Point) =>
    q.x >= Math.min(p.x, r.x) && q.x <= Math.max(p.x, r.x)
    && q.y >= Math.min(p.y, r.y) && q.y <= Math.max(p.y, r.y)
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)

  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true
  if (Math.abs(abC) < 0.001 && onSegment(a, c, b)) return true
  if (Math.abs(abD) < 0.001 && onSegment(a, d, b)) return true
  if (Math.abs(cdA) < 0.001 && onSegment(c, a, d)) return true
  return Math.abs(cdB) < 0.001 && onSegment(c, b, d)
}

const pointInsidePolygon = (point: Point, polygon: Point[]) => {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]
    const b = polygon[previous]
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

const polygonsTouch = (first: Point[], second: Point[]) => {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % first.length
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % second.length
      if (segmentsCross(first[firstIndex], first[firstNext], second[secondIndex], second[secondNext])) return true
    }
  }
  return pointInsidePolygon(first[0], second) || pointInsidePolygon(second[0], first)
}

export interface EilatProps {
  className?: string
  src?: string
  blobId?: string
  debug?: boolean
}

/** Static Figma composition for node 824:87601.
 * Layer order: arm behind the chair, thumb above the chair. */
export function Eilat({
  className,
  src: srcOverride,
  blobId,
}: EilatProps = {}) {
  const compositionRef = useRef<HTMLDivElement>(null)
  const computerCompositionRef = useRef<HTMLDivElement>(null)
  const rotation = useMotionValue(0)
  const chairRotation = useMotionValue(0)
  const computerRotation = useMotionValue(0)
  const computerChairRotation = useMotionValue(0)
  const dragState = useRef({ offset: 0, angle: 0, time: 0, velocity: 0 })
  const animationRef = useRef<ReturnType<typeof animate> | null>(null)
  const chairAnimationRef = useRef<ReturnType<typeof animate> | null>(null)
  const computerAnimations = useRef<ReturnType<typeof animate>[]>([])
  const playerIsDragging = useRef(false)
  const chairsWereTouching = useRef(false)
  const plasticHitPlayers = useRef<HTMLAudioElement[]>([])
  const plasticHitTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const { src, label, handleError } = useWinScreenBackground({
    variant: 'eilat',
    src: srcOverride,
    blobId,
  })

  const pointerAngle = (event: PointerEvent) => {
    const bounds = compositionRef.current?.getBoundingClientRect()
    if (!bounds) return 0

    // The arm leaves the frame at the lower-right corner of the Figma group.
    return Math.atan2(event.clientY - bounds.bottom, event.clientX - bounds.right) * (180 / Math.PI)
  }

  const playPlasticHit = () => {
    const soundIndex = Math.floor(Math.random() * plasticHitPlayers.current.length)
    const audio = plasticHitPlayers.current[soundIndex]
    if (!audio) return
    audio.pause()
    // Skip the short silence at the head of each recording.
    audio.currentTime = soundIndex === 0 ? 0.085 : 0.045
    audio.play().catch(() => { /* Audio may be blocked before a user gesture. */ })
    // Platic02 contains several later impacts in the same 4-second file. Only
    // its first transient belongs to this collision.
    plasticHitTimers.current.push(setTimeout(() => audio.pause(), 190))
  }

  const stopPlasticHits = () => {
    plasticHitTimers.current.forEach(clearTimeout)
    plasticHitTimers.current = []
    plasticHitPlayers.current.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
  }

  const runComputerHit = () => {
    computerAnimations.current.forEach((animation) => animation.stop())

    const windUp = animate(computerRotation, 15, {
      type: 'spring',
      stiffness: 180,
      damping: 15,
      onComplete: () => {
        const strike = animate(computerRotation, -43, {
          duration: 0.2,
          ease: [0.65, 0, 0.9, 0.45],
          onComplete: () => {
            computerAnimations.current = [
              animate(computerRotation, 0, {
                type: 'spring',
                stiffness: 120,
                damping: 11,
                mass: 1.25,
                onComplete: () => {
                  if (playerIsDragging.current) runComputerHit()
                },
              }),
              animate(computerChairRotation, 0, {
                type: 'spring',
                stiffness: 65,
                damping: 5,
                mass: 1.8,
              }),
            ]
          },
        })
        const chairStrike = animate(computerChairRotation, 48, {
          duration: 0.28,
          ease: 'easeOut',
        })
        computerAnimations.current = [strike, chairStrike]
      },
    })

    computerAnimations.current = [
      windUp,
      animate(computerChairRotation, -18, {
        type: 'spring',
        stiffness: 100,
        damping: 8,
      }),
    ]
  }

  const stopComputerHit = () => {
    computerAnimations.current.forEach((animation) => animation.stop())
    stopPlasticHits()
    computerAnimations.current = [
      animate(computerRotation, 0, {
        type: 'spring',
        stiffness: 190,
        damping: 18,
      }),
      animate(computerChairRotation, 0, {
        type: 'spring',
        stiffness: 120,
        damping: 13,
      }),
    ]
  }

  useEffect(() => {
    let collisionFrame = 0

    plasticHitPlayers.current = PLASTIC_HIT_SOUNDS.map((source) => {
      const audio = new Audio(source)
      audio.preload = 'auto'
      audio.volume = 0.75
      audio.load()
      return audio
    })

    const transformedChairShape = (
      composition: HTMLDivElement,
      handAngle: number,
      chairAngle: number,
      mirrored: boolean,
    ) => {
      const bounds = composition.getBoundingClientRect()
      const scale = bounds.width / 1118.291
      const originX = mirrored ? bounds.right : bounds.left
      const direction = mirrored ? -1 : 1
      const grip = { x: 722.19, y: 584.01 }
      const shoulder = { x: 1118.291, y: 1133.039 }

      return CHAIR_COLLISION_SHAPE.map(([x, y]) => {
        const chairMoved = rotatePoint({ x, y }, grip, chairAngle)
        const handMoved = rotatePoint(chairMoved, shoulder, handAngle)
        return {
          x: originX + handMoved.x * scale * direction,
          y: bounds.top + handMoved.y * scale,
        }
      })
    }

    const detectChairCollision = () => {
      if (playerIsDragging.current && compositionRef.current && computerCompositionRef.current) {
        const player = transformedChairShape(
          compositionRef.current, rotation.get(), chairRotation.get(), false,
        )
        const computer = transformedChairShape(
          computerCompositionRef.current,
          computerRotation.get(),
          computerChairRotation.get(),
          true,
        )
        const touching = polygonsTouch(player, computer)

        if (touching && !chairsWereTouching.current) playPlasticHit()
        chairsWereTouching.current = touching
      } else {
        chairsWereTouching.current = false
      }

      collisionFrame = requestAnimationFrame(detectChairCollision)
    }

    const stopOnGlobalRelease = () => {
      if (!playerIsDragging.current) return
      playerIsDragging.current = false
      stopComputerHit()
    }

    window.addEventListener('pointerup', stopOnGlobalRelease)
    window.addEventListener('pointercancel', stopOnGlobalRelease)
    window.addEventListener('blur', stopOnGlobalRelease)
    collisionFrame = requestAnimationFrame(detectChairCollision)

    return () => {
      window.removeEventListener('pointerup', stopOnGlobalRelease)
      window.removeEventListener('pointercancel', stopOnGlobalRelease)
      window.removeEventListener('blur', stopOnGlobalRelease)
      cancelAnimationFrame(collisionFrame)
      computerAnimations.current.forEach((animation) => animation.stop())
      plasticHitTimers.current.forEach(clearTimeout)
      plasticHitTimers.current = []
      plasticHitPlayers.current.forEach((audio) => {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      })
      plasticHitPlayers.current = []
    }
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    animationRef.current?.stop()
    chairAnimationRef.current?.stop()
    playerIsDragging.current = true
    chairsWereTouching.current = false
    runComputerHit()
    event.currentTarget.setPointerCapture(event.pointerId)
    const current = rotation.get()
    dragState.current = {
      offset: current - pointerAngle(event),
      angle: current,
      time: performance.now(),
      velocity: 0,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    const now = performance.now()
    const next = Math.max(-44, Math.min(34, pointerAngle(event) + dragState.current.offset))
    const elapsed = Math.max(now - dragState.current.time, 1)
    dragState.current.velocity = ((next - dragState.current.angle) / elapsed) * 1000
    dragState.current.angle = next
    dragState.current.time = now
    rotation.set(next)
    // The chair trails the hand slightly, as a weighted object would.
    chairRotation.set(Math.max(-50, Math.min(50, -dragState.current.velocity * 0.16)))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    playerIsDragging.current = false
    stopComputerHit()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const impactAngle = Math.max(
      -44,
      Math.min(34, rotation.get() + dragState.current.velocity * 0.13),
    )

    animationRef.current = animate(rotation, impactAngle, {
      type: 'spring',
      velocity: dragState.current.velocity,
      stiffness: 230,
      damping: 16,
      mass: 1,
      onComplete: () => {
        animationRef.current = animate(rotation, 0, {
          type: 'spring',
          stiffness: 125,
          damping: 12,
          mass: 1.3,
        })
      },
    })

    chairAnimationRef.current = animate(chairRotation, 0, {
      type: 'spring',
      velocity: -dragState.current.velocity * 0.95,
      stiffness: 68,
      damping: 5,
      mass: 1.8,
    })

  }

  return (
    <div
      className={[styles.screen, className].filter(Boolean).join(' ')}
      data-node="win-eilat"
    >
      <img
        className={styles.background}
        src={src}
        alt={label}
        draggable={false}
        onError={handleError}
      />

      <div ref={compositionRef} className={styles.composition} aria-hidden="true">
        <motion.div
          className={styles.movingGroup}
          style={{ rotate: rotation }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            className={styles.arm}
            src={`${ASSET_ROOT}/arm.svg`}
            alt=""
            draggable={false}
          />
          <motion.img
            className={styles.chair}
            src={`${ASSET_ROOT}/chair.svg`}
            alt=""
            draggable={false}
            style={{ rotate: chairRotation }}
          />
          <img
            className={styles.thumb}
            src={`${ASSET_ROOT}/thumb.svg`}
            alt=""
            draggable={false}
          />
        </motion.div>
      </div>

      <div
        ref={computerCompositionRef}
        className={[styles.composition, styles.computerComposition].join(' ')}
        aria-hidden="true"
      >
        <motion.div
          className={styles.movingGroup}
          style={{ rotate: computerRotation }}
        >
          <img
            className={styles.arm}
            src={`${ASSET_ROOT}/arm.svg`}
            alt=""
            draggable={false}
          />
          <motion.img
            className={[styles.chair, styles.computerChair].join(' ')}
            src={`${ASSET_ROOT}/chair.svg`}
            alt=""
            draggable={false}
            style={{ rotate: computerChairRotation }}
          />
          <img
            className={styles.thumb}
            src={`${ASSET_ROOT}/thumb.svg`}
            alt=""
            draggable={false}
          />
        </motion.div>
      </div>
    </div>
  )
}
