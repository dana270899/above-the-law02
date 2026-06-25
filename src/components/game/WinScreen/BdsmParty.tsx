import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { assetUrl } from '@/lib/paths'
import styles from './BdsmParty.module.css'

const ASSET_ROOT = assetUrl('/images/win-screens/BdsmParty')
const WINDOW_BG_SRC = `${ASSET_ROOT}/bg.svg`
const ENVELOPE_BG_SRC = `${ASSET_ROOT}/Envelope bg.svg`
const ENVELOPE_BODY_SRC = `${ASSET_ROOT}/Envelope.svg`
const ENVELOPE_FLAP_SRC = `${ASSET_ROOT}/Envelope open.svg`
const INVITATION_SRC = `${ASSET_ROOT}/Invitation.svg`
const STAMP_SRC = `${ASSET_ROOT}/stamp.svg`
const PAPER_SOUND_SRC = assetUrl('/sounds/paper.mp3')
const DEFAULT_WIN_TITLE = 'Win'
const DEFAULT_WIN_FOOTER_TEXT = 'Winning is so good'
const DEFAULT_WIN_CTA_LABEL = 'Love this job, next case!'

type InvitationPosition = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  scale: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface BdsmPartyProps {
  className?: string
  src?: string
  blobId?: string
  onComplete?: () => void
  winTitle?: string
  winFooterText?: string
  winCtaLabel?: string
  debug?: boolean
}

export function BdsmParty({
  className,
  onComplete,
  winTitle = DEFAULT_WIN_TITLE,
  winFooterText = DEFAULT_WIN_FOOTER_TEXT,
  winCtaLabel = DEFAULT_WIN_CTA_LABEL,
  debug = false,
}: BdsmPartyProps = {}) {
  const [isOpen, setIsOpen] = useState(false)
  const [invitationPosition, setInvitationPosition] =
    useState<InvitationPosition>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const screenRef = useRef<HTMLDivElement | null>(null)
  const invitationRef = useRef<HTMLImageElement | null>(null)

  const pulledOut =
    isOpen &&
    (isDragging ||
      Math.abs(invitationPosition.y) > 44 ||
      Math.abs(invitationPosition.x) > 44)

  useEffect(() => {
    function onPointerMove(e: globalThis.PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const nextX =
        drag.startX + (e.clientX - drag.startClientX) / drag.scale
      const nextY =
        drag.startY + (e.clientY - drag.startClientY) / drag.scale
      setInvitationPosition({
        x: Math.max(drag.minX, Math.min(drag.maxX, nextX)),
        y: Math.max(drag.minY, Math.min(drag.maxY, nextY)),
      })
    }

    function onPointerUp(e: globalThis.PointerEvent) {
      if (dragRef.current?.pointerId !== e.pointerId) return
      dragRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  function openEnvelope(e: PointerEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (isOpen) return
    playPaperSound()
    setIsOpen(true)
    setInvitationPosition({ x: 0, y: 0 })
  }

  function startInvitationDrag(e: PointerEvent<HTMLImageElement>) {
    if (!isOpen) return
    e.preventDefault()
    e.stopPropagation()
    playPaperSound()
    const screenElement = screenRef.current
    const screenRect = screenElement?.getBoundingClientRect()
    const invitationRect = invitationRef.current?.getBoundingClientRect()
    if (!screenElement || !screenRect || !invitationRect) return
    const scale = screenRect.width / screenElement.offsetWidth || 1
    const minX =
      (screenRect.left - invitationRect.left) / scale + invitationPosition.x
    const maxX =
      (screenRect.right - invitationRect.right) / scale + invitationPosition.x
    const minY =
      (screenRect.top - invitationRect.top) / scale + invitationPosition.y
    const maxY =
      (screenRect.bottom - invitationRect.bottom) / scale + invitationPosition.y
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: invitationPosition.x,
      startY: invitationPosition.y,
      scale,
      minX,
      maxX,
      minY,
      maxY,
    }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function playPaperSound() {
    const audio = new Audio(PAPER_SOUND_SRC)
    audio.play().catch(() => { /* autoplay blocked — ignore */ })
  }

  const invitationStyle = {
    '--invitation-x': `${invitationPosition.x}px`,
    '--invitation-y': `${invitationPosition.y}px`,
  } as CSSProperties

  return (
    <div
      className={[
        styles.window,
        className,
        isOpen ? styles.screenOpen : '',
        pulledOut ? styles.screenPulledOut : '',
        isDragging ? styles.screenDragging : '',
        debug ? styles.debug : '',
      ].filter(Boolean).join(' ')}
      data-node="win-bdsm-party"
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
      <div className={styles.screen} ref={screenRef}>
        <img
          className={styles.windowBg}
          src={WINDOW_BG_SRC}
          alt=""
          draggable={false}
        />
        <div className={styles.stage}>
          <div className={styles.envelopeShadow} />
          <img
            className={styles.envelopeBg}
            src={ENVELOPE_BG_SRC}
            alt=""
            draggable={false}
          />
          <img
            className={styles.backFlap}
            src={ENVELOPE_FLAP_SRC}
            alt=""
            draggable={false}
          />
          <img
            ref={invitationRef}
            className={styles.invitation}
            src={INVITATION_SRC}
            alt="Invitation"
            draggable={false}
            style={invitationStyle}
            onPointerDown={startInvitationDrag}
          />
          <img
            className={styles.envelopeBody}
            src={ENVELOPE_BODY_SRC}
            alt=""
            draggable={false}
          />
          <img
            className={styles.stamp}
            src={STAMP_SRC}
            alt=""
            draggable={false}
          />
          <button
            type="button"
            className={styles.closedFlapButton}
            aria-label={isOpen ? 'Envelope is open' : 'Open envelope'}
            onPointerDown={openEnvelope}
          >
            <img
              className={styles.closedFlap}
              src={ENVELOPE_FLAP_SRC}
              alt=""
              draggable={false}
            />
          </button>
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
          {winCtaLabel}
        </button>
      </div>
    </div>
  )
}
