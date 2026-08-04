import { describe, expect, it, vi } from 'vitest'
import type { GamePreloadAsset } from './gamePreloadAssets'
import { GameAssetPreloader } from './gameAssetPreloader'

const image = (src: string): GamePreloadAsset => ({ kind: 'image', src })
const audio = (src: string): GamePreloadAsset => ({ kind: 'audio', src })

describe('GameAssetPreloader', () => {
  it('deduplicates a URL across repeated game runs', async () => {
    const loader = vi.fn(async () => ({}))
    const preloader = new GameAssetPreloader({
      loader,
      schedule: (run) => run(),
    })

    await Promise.all([
      preloader.preload(image('/images/case.svg')),
      preloader.preload(image('/images/case.svg')),
    ])
    await preloader.preload(image('/images/case.svg'))

    expect(loader).toHaveBeenCalledTimes(1)
    expect(preloader.hasLoaded('/images/case.svg')).toBe(true)
  })

  it('limits total work and media work while preserving priority', async () => {
    const starts: string[] = []
    const releases = new Map<string, () => void>()
    const loader = vi.fn((asset: GamePreloadAsset) => new Promise<void>((resolve) => {
      starts.push(asset.src)
      releases.set(asset.src, resolve)
    }))
    const scheduled: Array<() => void> = []
    const preloader = new GameAssetPreloader({
      loader,
      maxConcurrent: 2,
      maxConcurrentMedia: 1,
      schedule: (run) => scheduled.push(run),
    })

    const firstAudio = preloader.preload(audio('/sounds/first.mp3'), 2)
    const secondAudio = preloader.preload(audio('/sounds/second.mp3'), 1)
    const urgentImage = preloader.preload(image('/images/urgent.svg'), 0)
    scheduled.shift()?.()

    expect(starts).toHaveLength(2)
    expect(starts.some((src) => src.endsWith('/images/urgent.svg'))).toBe(true)
    expect(starts.filter((src) => src.includes('/sounds/'))).toHaveLength(1)

    const activeAudio = starts.find((src) => src.includes('/sounds/'))
    expect(activeAudio).toBeDefined()
    releases.get(activeAudio!)?.()
    await vi.waitFor(() => expect(starts).toHaveLength(3))
    for (const resolve of releases.values()) resolve()
    await Promise.all([firstAudio, secondAudio, urgentImage])
  })

  it('pins a decoded critical image outside the bounded retained cache', async () => {
    const loader = vi.fn(async (asset: GamePreloadAsset) => ({ src: asset.src }))
    const preloader = new GameAssetPreloader({
      loader,
      retainedLimit: 1,
      schedule: (run) => run(),
    })

    await preloader.preloadAndRetain(image('/images/win-screens/Pizza/Police.svg'), 0)
    await preloader.preload(image('/images/one.svg'))
    await preloader.preload(image('/images/two.svg'))

    expect(preloader.hasLoaded('/images/win-screens/Pizza/Police.svg')).toBe(true)
    expect(preloader.hasRetained('/images/win-screens/Pizza/Police.svg')).toBe(true)
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({ src: expect.stringContaining('/images/win-screens/Pizza/Police.svg') }),
      0,
    )
  })
})
