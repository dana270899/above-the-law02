import { useEffect, useRef, useState, type FormEvent } from 'react'
import { assetUrl } from '@/lib/paths'
import type { PlayerProfile } from '@/lib/scoring'
import { requestCameraStream, stopCameraStream } from '@/lib/camera'
import styles from './LoginScreen.module.css'

/**
 * LOGIN SCREEN
 * Responsive implementation of the Figma "Login Screen" frame.
 * Accepts ANY non-empty input. Button is disabled until the player types something.
 *
 * `onLogin` is invoked with the trimmed name when the form is submitted.
 * The game flow uses this to advance to the next node in the graph.
 */
export interface LoginScreenProps {
  onLogin?: (profile: PlayerProfile) => void
  initialCameraStream?: MediaStream | null
}

export function LoginScreen({ onLogin, initialCameraStream = null }: LoginScreenProps = {}) {
  const [value, setValue] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoHasBuiltInBorder, setPhotoHasBuiltInBorder] = useState(false)
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(initialCameraStream)

  function stopCamera() {
    stopCameraStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
  }

  useEffect(() => () => {
    stopCameraStream(streamRef.current)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOpen || !photoPickerOpen || !video || !stream) return
    if (video.srcObject !== stream) video.srcObject = stream
    void video.play().catch(() => {})
  }, [cameraOpen, photoPickerOpen])

  async function openCamera() {
    setCameraError('')
    if (streamRef.current?.active) {
      setCameraOpen(true)
      return
    }
    try {
      const stream = await requestCameraStream()
      streamRef.current = stream
      setCameraOpen(true)
    } catch (reason) {
      setCameraError(reason instanceof Error ? reason.message : 'The camera could not be started.')
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return
    const size = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 600
    const context = canvas.getContext('2d')
    if (!context) return
    const sourceX = (video.videoWidth - size) / 2
    const sourceY = (video.videoHeight - size) / 2
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
    context.drawImage(video, sourceX, sourceY, size, size, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
      setPhoto(blob)
      setPhotoPreviewUrl(URL.createObjectURL(blob))
      setPhotoHasBuiltInBorder(false)
      stopCamera()
      setPhotoPickerOpen(false)
    }, 'image/jpeg', .9)
  }

  async function choosePreset(path: string | null) {
    if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
    if (!path) {
      setPhoto(null)
      setPhotoPreviewUrl(null)
      setPhotoHasBuiltInBorder(false)
      stopCamera()
      setPhotoPickerOpen(false)
      return
    }
    const src = assetUrl(path)
    setPhotoPreviewUrl(src)
    setPhotoHasBuiltInBorder(true)
    try {
      const response = await fetch(src)
      setPhoto(await response.blob())
    } catch {
      setPhoto(null)
    }
    stopCamera()
    setPhotoPickerOpen(false)
  }

  function handleLogin(e?: FormEvent) {
    e?.preventDefault()
    const name = value.trim()
    if (!name || !photoPreviewUrl) return
    onLogin?.({ name, photo, photoPreviewUrl })
  }

  const canLogin = !!value.trim() && !!photoPreviewUrl

  return (
    <div className={styles.screen} data-node="login">

      {/* Top decorative bar */}
      <div className={`${styles.bar} ${styles.barTop}`} />

      {/* "Welcome" heading */}
      <h1 className={styles.welcome} data-text="Welcome">
        <span className={styles.welcomeText}>Welcome</span>
      </h1>

      {/* Center group: badge + divider + profile form */}
      <div className={styles.center}>

        {/* Police badge */}
        <div className={styles.badge}>
          <img src={assetUrl('/images/login-screen/Logo-S.svg')} className={styles.badgeLogo} alt="" />
        </div>

        {/* Vertical divider */}
        <div className={styles.divider} />

        <form className={styles.fields} onSubmit={handleLogin}>
          <button
            type="button"
            className={`${styles.photoPicker} ${photoHasBuiltInBorder ? styles.photoPickerBuiltInBorder : ''}`}
            onClick={() => { setPhotoPickerOpen(true); openCamera() }}
          >
            {photoPreviewUrl ? (
              <img className={styles.photoPreview} src={photoPreviewUrl} alt="Selected profile" />
            ) : (
              <>
                <img className={styles.photoIcon} src={assetUrl('/images/login-screen/add_photo_alternate.svg')} alt="" />
                <span>Pick a photo</span>
              </>
            )}
          </button>

          <div className={styles.row}>
              <input
                type="text"
                className={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter your name"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className={styles.loginBtn}
                aria-label="Login"
                aria-disabled={!canLogin}
                disabled={!canLogin}
              >
                <span aria-hidden="true">→</span>
              </button>
          </div>
        </form>
      </div>

      {photoPickerOpen && (
        <div className={styles.photoWindowLayer}>
          <section className={styles.photoWindow} role="dialog" aria-modal="true" aria-label="Photos">
            <header className={styles.photoWindowHeader}>
              <span>Photos</span>
              <button type="button" className={styles.photoWindowClose} onClick={() => { stopCamera(); setPhotoPickerOpen(false) }} aria-label="Close photos">×</button>
            </header>
            <div className={styles.photoChoices}>
              <p className={styles.photoPrompt}>Pick a photo</p>
              <div className={styles.photoChoiceRow}>
              <div className={styles.cameraOption}>
                <button type="button" className={`${styles.photoChoice} ${styles.cameraChoice}`} onClick={cameraOpen ? capturePhoto : openCamera} aria-label="Take a photo with camera">
                  {cameraOpen && <video ref={videoRef} className={styles.cameraTileVideo} muted playsInline autoPlay preload="auto" />}
                </button>
                <span className={styles.recommended}><span aria-hidden="true">★</span>Recommended</span>
              </div>
              {[
                ['/images/login-screen/Man.svg', 'Man'],
                ['/images/login-screen/Flower.svg', 'Flower'],
                ['/images/login-screen/Gun.svg', 'Gun'],
              ].map(([path, label]) => (
                <button key={path} type="button" className={`${styles.photoChoice} ${styles.photoAssetChoice}`} onClick={() => choosePreset(path)} aria-label={`Choose ${label}`}>
                  <img src={assetUrl(path)} alt="" />
                </button>
              ))}
              </div>
            </div>
            {cameraError && <p className={styles.cameraError}>{cameraError}</p>}
          </section>
        </div>
      )}

      {/* Bottom decorative bar */}
      <div className={`${styles.bar} ${styles.barBottom}`} />
    </div>
  )
}
