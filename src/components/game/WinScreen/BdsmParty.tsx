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
const ENVELOPE_BODY_SRC = `${ASSET_ROOT}/Envelope.svg`
const ENVELOPE_FLAP_SRC = `${ASSET_ROOT}/Envelope open.svg`
const INVITATION_SRC = `${ASSET_ROOT}/Invitation.svg`
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

  const pulledOut =
    isOpen &&
    (Math.abs(invitationPosition.y) > 8 || Math.abs(invitationPosition.x) > 9)

  useEffect(() => {
    function onPointerMove(e: globalThis.PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const nextX = drag.startX + ((e.clientX - drag.startClientX) / 520) * 100
      const nextY = drag.startY + ((e.clientY - drag.startClientY) / 390) * 100
      setInvitationPosition({
        x: Math.max(-32, Math.min(32, nextX)),
        y: Math.max(-34, Math.min(18, nextY)),
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
    setIsOpen(true)
    setInvitationPosition({ x: 0, y: 0 })
  }

  function startInvitationDrag(e: PointerEvent<HTMLImageElement>) {
    if (!isOpen) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: invitationPosition.x,
      startY: invitationPosition.y,
    }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const invitationStyle = {
    '--invitation-x': `${invitationPosition.x}%`,
    '--invitation-y': `${invitationPosition.y}%`,
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
      <div className={styles.screen}>
        <div className={styles.stage}>
          <div className={styles.envelopeShadow} />
          <img
            className={styles.backFlap}
            src={ENVELOPE_FLAP_SRC}
            alt=""
            draggable={false}
          />
          <div className={styles.openFlap} />
          <img
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
