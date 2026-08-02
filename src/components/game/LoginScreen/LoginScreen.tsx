import { useEffect, useState, type FormEvent } from 'react'
import { assetUrl } from '@/lib/paths'
import { requestCameraStream, stopCameraStream } from '@/lib/camera'
import type { PlayerProfile } from '@/lib/scoring'
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
}

export function LoginScreen({ onLogin }: LoginScreenProps = {}) {
  const [value, setValue] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoHasBuiltInBorder, setPhotoHasBuiltInBorder] = useState(false)
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)

  function requestLoginCameraPermission() {
    return requestCameraStream()
      .then((stream) => stopCameraStream(stream))
      .catch(() => {
        // Keep the login design unchanged if access is unavailable.
      })
  }

  // Prompt as soon as the login screen appears. The photo-picker click below
  // retries from a user gesture on browsers that suppress automatic prompts.
  useEffect(() => {
    void requestLoginCameraPermission()
  }, [])

  async function choosePreset(path: string | null) {
    if (photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(photoPreviewUrl)
    if (!path) {
      setPhoto(null)
      setPhotoPreviewUrl(null)
      setPhotoHasBuiltInBorder(false)
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
    setPhotoPickerOpen(false)
  }

  function handleLogin(e?: FormEvent) {
    e?.preventDefault()
    const name = value.trim()
    if (!name || !photo || !photoPreviewUrl) return
    onLogin?.({ name, photo, photoPreviewUrl })
  }

  const canLogin = !!value.trim() && !!photo && !!photoPreviewUrl

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
            onClick={() => {
              setPhotoPickerOpen(true)
              void requestLoginCameraPermission()
            }}
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
                <img src={assetUrl('/images/login-screen/arrow_forward.svg')} alt="" aria-hidden="true" />
              </button>
          </div>
        </form>
      </div>

      {photoPickerOpen && (
        <div className={styles.photoWindowLayer}>
          <section className={styles.photoWindow} role="dialog" aria-modal="true" aria-label="Photos">
            <header className={styles.photoWindowHeader}>
              <span>Photos</span>
              <button type="button" className={styles.photoWindowClose} onClick={() => setPhotoPickerOpen(false)} aria-label="Close photos">×</button>
            </header>
            <div className={styles.photoChoices}>
              <p className={styles.photoPrompt}>Pick a photo</p>
              <div className={styles.photoChoiceRow}>
              {[
                ['/images/login-screen/Man.svg', 'Man'],
                ['/images/login-screen/Woman.svg', 'Woman'],
                ['/images/login-screen/Flower.svg', 'Flower'],
                ['/images/login-screen/Gun.svg', 'Gun'],
              ].map(([path, label]) => (
                <button key={path} type="button" className={`${styles.photoChoice} ${styles.photoAssetChoice}`} onClick={() => choosePreset(path)} aria-label={`Choose ${label}`}>
                  <img src={assetUrl(path)} alt="" />
                </button>
              ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Bottom decorative bar */}
      <div className={`${styles.bar} ${styles.barBottom}`} />
    </div>
  )
}
