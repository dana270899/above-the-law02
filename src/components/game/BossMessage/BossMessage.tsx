import styles from './BossMessage.module.css'

/* ═══════════════════════════════════════════════
   BOSS MESSAGE
   Pixel-perfect implementation of the three Chat
   message variants from Figma frame 170:1999.
   - voice : mic button + progress bar
   - text  : body text only
   - link  : body text + green "Open" CTA
════════════════════════════════════════════════ */

type Common = {
  sender?: string        // defaults to "Boss"
  timestamp?: string     // defaults to "now"
  className?: string
}

type VoiceProps = Common & {
  type: 'voice'
  onPlay?: () => void
  /** Optional subtitle rendered below the voice track. */
  subtitle?: string
  /** Voice clip length in seconds — drives the playhead animation. */
  duration?: number
  /** Bump this to restart the playhead animation from the beginning
   *  (used when the player taps the mic to replay the clip). Acts as
   *  a React `key` on the playhead so it remounts. */
  playKey?: number
}

type TextProps = Common & {
  type: 'text'
  text: string
}

type LinkProps = Common & {
  type: 'link'
  text: string
  buttonLabel?: string   // defaults to "Open"
  onButtonClick?: () => void
}

export type BossMessageProps = VoiceProps | TextProps | LinkProps

export function BossMessage(props: BossMessageProps) {
  const { type, sender = 'Boss', timestamp = 'now', className } = props

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <div className={styles.card}>

        {/* "Chat" header bar */}
        <div className={styles.headerBar}>
          <span className={styles.headerLabel}>Chat</span>
        </div>

        {/* Body row: avatar + content + timestamp */}
        <div className={`${styles.body} ${type === 'link' ? styles.bodyLink : ''}`}>
          <BossAvatar />

          <div className={`${styles.content} ${
            type === 'voice' ? styles.contentVoice :
            type === 'link'  ? styles.contentLink  :
                               styles.contentText
          }`}>
            <p className={styles.senderName}>{sender}</p>

            {type === 'voice' && (
              <>
                <div className={styles.voice}>
                  <div className={styles.voiceTrack} />
                  <button
                    type="button"
                    className={styles.voiceMicBtn}
                    aria-label="Play voice message"
                    onClick={(props as VoiceProps).onPlay}
                  >
                    <img src="/images/boss/mic.svg" alt="" className={styles.voiceMicIcon} />
                  </button>
                  {/* Yellow playhead — CSS animates `left` from start of
                      track to end over `--voice-duration` seconds. The
                      `key` prop forces a remount on each replay so the
                      animation restarts from the beginning. */}
                  <div
                    key={(props as VoiceProps).playKey ?? 0}
                    className={styles.voicePlayhead}
                    style={{
                      ['--voice-duration' as string]:
                        `${(props as VoiceProps).duration ?? 5}s`,
                    } as React.CSSProperties}
                  />
                </div>
                {(props as VoiceProps).subtitle && (
                  <p className={styles.subtitle}>{(props as VoiceProps).subtitle}</p>
                )}
              </>
            )}

            {(type === 'text' || type === 'link') && (
              <p className={styles.bodyText}>{props.text}</p>
            )}
          </div>

          <div className={styles.timestamp}>{timestamp}</div>
        </div>

        {/* Footer (link variant only) */}
        {type === 'link' && (
          <div className={styles.footer}>
            <button
              type="button"
              data-spot="boss.button"
              className={styles.cta}
              onClick={props.onButtonClick}
            >
              {props.buttonLabel ?? 'Open'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Boss avatar (120×120 pixel portrait) ───────
   Layered SVG + CSS pieces, exactly like the player
   avatar in LoginScreen. SVGs live in /images/boss/. */
function BossAvatar() {
  return (
    <div className={styles.avatar}>
      <img src="/images/boss/boss-hair.svg"     alt="" className={styles.hair} />
      <div className={styles.head} />
      <img src="/images/boss/boss-nose.svg"     alt="" className={styles.nose} />
      <img src="/images/boss/boss-glasses.svg"  alt="" className={styles.glasses} />
      <img src="/images/boss/boss-noseline.svg" alt="" className={styles.noseline} />
      <img src="/images/boss/boss-mustache.svg" alt="" className={styles.mustache} />
      <img src="/images/boss/boss-stache2.svg"  alt="" className={styles.stache2} />
      <div className={styles.eyebrowR} />
      <div className={styles.eyebrowL} />
      <div className={styles.lipsFill} />
      <img src="/images/boss/boss-mouth.svg"    alt="" className={styles.lipsMouth} />
      <div className={styles.lipsBorder} />
      <div className={styles.eyeOuterR} />
      <div className={styles.eyeOuterL} />
      <img src="/images/boss/boss-cheekL.svg"   alt="" className={styles.cheekL} />
      <img src="/images/boss/boss-cheekR.svg"   alt="" className={styles.cheekR} />
    </div>
  )
}
