import { useEffect, useRef, useState } from 'react'
import { requestCameraStream, stopCameraStream } from '@/lib/camera'
import { assetUrl } from '@/lib/paths'
import type { PlayerProfile } from '@/lib/scoring'
import styles from './ScorePublishScreen.module.css'

interface ScorePublishScreenProps {
  profile: PlayerProfile
  fallbackProfile?: PlayerProfile
  score: number
  onPublish: (profile: PlayerProfile) => void
}

export function profileWithFallbackPhoto(name: string, fallbackProfile?: PlayerProfile): PlayerProfile {
  return {
    name: name.trim(),
    photo: fallbackProfile?.photo ?? null,
    photoPreviewUrl: fallbackProfile?.photoPreviewUrl ?? null,
  }
}

export function ScorePublishScreen({ profile, fallbackProfile, score, onPublish }: ScorePublishScreenProps) {
  const hasInitialPhoto = !!profile.photo && !!profile.photoPreviewUrl
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [name, setName] = useState(profile.name)
  const [countdown, setCountdown] = useState(hasInitialPhoto ? 0 : 5)
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(profile.photo ?? null)
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(profile.photoPreviewUrl ?? null)
  const [cameraReady, setCameraReady] = useState(false)
  const [photoReady, setPhotoReady] = useState(hasInitialPhoto)

  useEffect(() => {
    if (hasInitialPhoto) return
    let active = true
    void requestCameraStream().then((stream) => {
      if (!active) {
        stopCameraStream(stream)
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        void video.play().then(() => setCameraReady(true)).catch(() => undefined)
      }
    }).catch(() => {
      // The saved profile picture remains visible if camera access is unavailable.
    })

    return () => {
      active = false
      stopCameraStream(streamRef.current)
      streamRef.current = null
    }
  }, [hasInitialPhoto])

  useEffect(() => {
    if (!cameraReady || countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cameraReady, countdown])

  useEffect(() => {
    if (!cameraReady || countdown !== 0) return
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((capturedPhoto) => {
      if (!capturedPhoto) return
      setCapturedPhoto(capturedPhoto)
      setCapturedPreviewUrl(URL.createObjectURL(capturedPhoto))
      setPhotoReady(true)
      stopCameraStream(streamRef.current)
      streamRef.current = null
    }, 'image/jpeg', 0.9)
  }, [cameraReady, countdown])

  const displayCountdown = `00:${String(Math.max(0, countdown)).padStart(2, '0')}`

  async function takeAgain() {
    if (capturedPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(capturedPreviewUrl)
    stopCameraStream(streamRef.current)
    streamRef.current = null
    setCapturedPhoto(null)
    setCapturedPreviewUrl(null)
    setPhotoReady(false)
    setCameraReady(false)
    setCountdown(5)

    try {
      const stream = await requestCameraStream()
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopCameraStream(stream)
        streamRef.current = null
        return
      }
      video.srcObject = stream
      await video.play()
      setCameraReady(true)
    } catch {
      // Leave both publishing actions unavailable until a new photo is captured.
    }
  }

  function publishWithoutPhoto() {
    const nextProfile = profileWithFallbackPhoto(name, fallbackProfile)
    if (
      capturedPreviewUrl?.startsWith('blob:')
      && capturedPreviewUrl !== nextProfile.photoPreviewUrl
    ) {
      URL.revokeObjectURL(capturedPreviewUrl)
    }
    setCapturedPhoto(nextProfile.photo ?? null)
    setCapturedPreviewUrl(nextProfile.photoPreviewUrl ?? null)
    onPublish(nextProfile)
  }

  return (
    <main className={styles.page} data-node-id="924:69481">
      <div className={`${styles.blueBar} ${styles.blueBarTop}`} />
      <div className={`${styles.blueBar} ${styles.blueBarBottom}`} />

      <div className={styles.scoreBanner} aria-label={`${score.toLocaleString('en-US')} points`}>
        <span className={`${styles.strap} ${styles.strapLeft}`} />
        <span className={`${styles.strap} ${styles.strapRight}`} />
        <img src={assetUrl('/images/ranking-board/score-ribbon.svg')} alt="" />
        <svg className={styles.scoreText} viewBox="0 0 596 146" aria-hidden="true">
          <defs>
            <path id="score-ribbon-text-curve" d="M 92 108 Q 298 66 504 108" />
          </defs>
          <text>
            <textPath href="#score-ribbon-text-curve" startOffset="50%" textAnchor="middle">
              {score.toLocaleString('en-US')} points
            </textPath>
          </text>
        </svg>
      </div>

      <section className={styles.form}>
        <div className={styles.photo}>
          {capturedPreviewUrl && countdown === 0 && (
            <img src={capturedPreviewUrl} alt="Your ranking portrait" />
          )}
          <video ref={videoRef} muted playsInline className={countdown === 0 ? styles.hiddenVideo : ''} />
          {countdown > 0 && (
            <div className={styles.countdown} aria-live="polite">
              <strong>{displayCountdown}</strong>
              <span>Say cheese!</span>
            </div>
          )}
          {capturedPreviewUrl && countdown === 0 && (
            <button type="button" className={styles.takeAgain} onClick={() => void takeAgain()}>
              Take again
            </button>
          )}
        </div>

        <input
          className={styles.nameInput}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Name"
          autoComplete="off"
          spellCheck={false}
        />

        <div className={styles.publishActions}>
          <button
            type="button"
            className={styles.publishButton}
            disabled={!name.trim() || !capturedPhoto || !capturedPreviewUrl || !photoReady}
            onClick={() => onPublish({
              name: name.trim(),
              photo: capturedPhoto,
              photoPreviewUrl: capturedPreviewUrl,
            })}
          >
            Publish my score
          </button>
          <button
            type="button"
            className={`${styles.publishButton} ${styles.publishWithoutImage}`}
            disabled={!name.trim()}
            onClick={publishWithoutPhoto}
          >
            Publish without my image
          </button>
        </div>
      </section>
    </main>
  )
}
