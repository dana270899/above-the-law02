import backgroundUrl from './assets/game-bg.png?url'
import grandma01Url from './assets/grandma-01.webp?url'
import grandma02Url from './assets/grandma-02.webp?url'
import grandma03Url from './assets/grandma-03.webp?url'
import hammerUrl from './assets/hammer.webp?url'
import lifeEmptyUrl from './assets/life-empty.webp?url'
import lifeFullUrl from './assets/life-full.webp?url'
import ouchUrl from './assets/ouch.mp3?url'

export const optimizedMiniGameAssets = {
  background: backgroundUrl,
  grandmas: [
    { name: 'Lech grandma', url: grandma01Url },
    { name: 'Democracy grandma', url: grandma02Url },
    { name: 'Peace grandma', url: grandma03Url },
  ],
  hammer: hammerUrl,
  lifeEmpty: lifeEmptyUrl,
  lifeFull: lifeFullUrl,
  ouch: ouchUrl,
} as const

let criticalAssetPreparation: Promise<void> | null = null

function loadAndDecodeImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false

    const fail = () => {
      if (settled) return
      settled = true
      reject(new Error(`Could not load mini-game asset: ${url}`))
    }

    const decode = async () => {
      if (settled) return

      try {
        if (typeof image.decode === 'function') await image.decode()
        if (image.naturalWidth === 0) throw new Error('Image has no decoded pixels')
        settled = true
        resolve()
      } catch {
        fail()
      }
    }

    image.decoding = 'async'
    image.addEventListener('load', () => void decode(), { once: true })
    image.addEventListener('error', fail, { once: true })
    image.src = url

    // A memory-cached image can be complete before its load listener runs.
    if (image.complete) queueMicrotask(() => void decode())
  })
}

/**
 * Downloads and decodes the artwork needed for the first playable frame.
 * Failed attempts are deliberately not cached so the UI's Retry action can
 * perform a fresh attempt without reloading the page.
 */
export function prepareMiniGameAssets(): Promise<void> {
  if (criticalAssetPreparation) return criticalAssetPreparation

  const criticalUrls = [
    optimizedMiniGameAssets.background,
    ...optimizedMiniGameAssets.grandmas.map((grandma) => grandma.url),
    optimizedMiniGameAssets.hammer,
    optimizedMiniGameAssets.lifeEmpty,
    optimizedMiniGameAssets.lifeFull,
  ]

  criticalAssetPreparation = Promise.all(criticalUrls.map(loadAndDecodeImage))
    .then(() => undefined)
    .catch((error: unknown) => {
      criticalAssetPreparation = null
      throw error
    })

  return criticalAssetPreparation
}
