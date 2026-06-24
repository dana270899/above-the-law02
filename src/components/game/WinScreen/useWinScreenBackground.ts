import { useEffect, useState, type SyntheticEvent } from 'react'
import {
  loadWinScreenImage,
  WIN_IMAGE_EVENT,
  winScreenImageKey,
  type WinImageEventDetail,
  type WinVariant,
} from '@/lib/winScreenImage'
import { getWinScreen } from '@/lib/winScreens'
import { loadAudioBlob } from '@/lib/audioBlobStore'

/**
 * Resolves the background image for a win-screen variant, honoring the
 * full override chain — explicit `src`, per-node IndexedDB blob, per-
 * variant localStorage override, then the bundled registry default.
 *
 * Re-renders when same-tab uploads (`WIN_IMAGE_EVENT`) or cross-document
 * `storage` events change the override for the active variant.
 *
 * Shared by `InteractiveWinScreen` and by custom variants that need a
 * different layout but still want the same upload-override behavior.
 */
export interface UseWinScreenBackgroundArgs {
  variant: WinVariant
  src?: string
  blobId?: string
}

export interface WinScreenBackground {
  src: string
  defaultSrc: string
  label: string
  /** Drop into `<img onError={handleError}>` to fall back to the bundled
   *  default once if a corrupt override fails to decode. */
  handleError: (e: SyntheticEvent<HTMLImageElement>) => void
}

export function useWinScreenBackground({
  variant,
  src: srcOverride,
  blobId,
}: UseWinScreenBackgroundArgs): WinScreenBackground {
  const option = getWinScreen(variant)
  const defaultSrc = option.src
  const [src, setSrc] = useState<string>(
    () => srcOverride ?? loadWinScreenImage(variant) ?? defaultSrc,
  )

  // IDB-backed override (per-node upload). Async — the sync state above
  // paints something immediately while the blob resolves.
  useEffect(() => {
    if (!blobId) return
    let cancelled = false
    let url: string | null = null
    loadAudioBlob(blobId)
      .then((blob) => {
        if (cancelled) return
        if (!blob) {
          setSrc(srcOverride ?? loadWinScreenImage(variant) ?? defaultSrc)
          return
        }
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(srcOverride ?? loadWinScreenImage(variant) ?? defaultSrc)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [variant, defaultSrc, srcOverride, blobId])

  // Same-tab custom event + cross-document `storage` event keep the
  // background in sync with editor uploads. An explicit src/blobId
  // skips this entire chain — caller owns the value.
  useEffect(() => {
    if (blobId) return
    function refresh() {
      setSrc(srcOverride ?? loadWinScreenImage(variant) ?? defaultSrc)
    }
    refresh()
    if (srcOverride) return
    function onWinEvent(e: Event) {
      const ce = e as CustomEvent<WinImageEventDetail>
      if (!ce.detail || ce.detail.variant === variant) refresh()
    }
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === winScreenImageKey(variant)) refresh()
    }
    window.addEventListener(WIN_IMAGE_EVENT, onWinEvent)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(WIN_IMAGE_EVENT, onWinEvent)
      window.removeEventListener('storage', onStorage)
    }
  }, [variant, defaultSrc, srcOverride, blobId])

  function handleError(e: SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget
    if (el.src === defaultSrc) return
    el.src = defaultSrc
  }

  return { src, defaultSrc, label: option.label, handleError }
}
