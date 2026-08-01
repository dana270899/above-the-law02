import type { GamePreloadAsset } from './gamePreloadAssets'

export type GameAssetLoader = (asset: GamePreloadAsset) => Promise<unknown>

type QueueItem = {
  asset: GamePreloadAsset
  key: string
  priority: number
  order: number
  promise: Promise<void>
  resolve: () => void
  reject: (reason: unknown) => void
}

type Scheduler = (run: () => void, priority: number) => void

export interface GameAssetPreloaderOptions {
  loader?: GameAssetLoader
  maxConcurrent?: number
  maxConcurrentMedia?: number
  schedule?: Scheduler
  retainedLimit?: number
}

const DEFAULT_RETAINED_LIMIT = 16

/**
 * Small priority queue used by the graph-aware preload hook.
 *
 * The instance exported at the bottom of this file intentionally lives at
 * module scope: a fresh GamePage can remount without throwing away URLs that
 * were already fetched during the previous run.
 */
export class GameAssetPreloader {
  private readonly loader: GameAssetLoader
  private readonly maxConcurrent: number
  private readonly maxConcurrentMedia: number
  private readonly schedule: Scheduler
  private readonly retainedLimit: number
  private readonly ready = new Set<string>()
  private readonly inFlight = new Map<string, QueueItem>()
  private readonly queued = new Map<string, QueueItem>()
  private readonly retained = new Map<string, unknown>()
  private activeCount = 0
  private activeMediaCount = 0
  private nextOrder = 0
  private pumpScheduled = false

  constructor(options: GameAssetPreloaderOptions = {}) {
    this.loader = options.loader ?? loadBrowserAsset
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 2)
    this.maxConcurrentMedia = Math.max(1, options.maxConcurrentMedia ?? 1)
    this.schedule = options.schedule ?? scheduleBrowserWork
    this.retainedLimit = Math.max(0, options.retainedLimit ?? DEFAULT_RETAINED_LIMIT)
  }

  preload(asset: GamePreloadAsset, priority = 1): Promise<void> {
    const key = canonicalAssetKey(asset.src)
    if (!key || this.ready.has(key)) return Promise.resolve()

    const existing = this.queued.get(key) ?? this.inFlight.get(key)
    if (existing) {
      existing.priority = Math.min(existing.priority, priority)
      this.requestPump(existing.priority)
      return existing.promise
    }

    let resolveItem!: () => void
    let rejectItem!: (reason: unknown) => void
    const promise = new Promise<void>((resolve, reject) => {
      resolveItem = resolve
      rejectItem = reject
    })
    const item: QueueItem = {
      asset: { ...asset, src: key },
      key,
      priority,
      order: this.nextOrder++,
      promise,
      resolve: resolveItem,
      reject: rejectItem,
    }
    this.queued.set(key, item)
    this.requestPump(priority)
    return promise
  }

  preloadMany(assets: readonly GamePreloadAsset[], priority = 1): void {
    for (const asset of assets) {
      void this.preload(asset, priority).catch(() => {
        // A failed speculative request must never interrupt the game. The URL
        // remains retryable if it becomes part of a later immediate frontier.
      })
    }
  }

  hasLoaded(src: string): boolean {
    const key = canonicalAssetKey(src)
    return !!key && this.ready.has(key)
  }

  private requestPump(priority: number) {
    if (this.pumpScheduled) return
    this.pumpScheduled = true
    this.schedule(() => {
      this.pumpScheduled = false
      this.pump()
    }, priority)
  }

  private pump() {
    while (this.activeCount < this.maxConcurrent && this.queued.size > 0) {
      const item = this.takeNextItem()
      if (!item) return
      const isMedia = item.asset.kind !== 'image'
      this.queued.delete(item.key)
      this.inFlight.set(item.key, item)
      this.activeCount++
      if (isMedia) this.activeMediaCount++

      void this.loader(item.asset)
        .then((resource) => {
          this.ready.add(item.key)
          this.retain(item.key, resource)
          item.resolve()
        })
        .catch((reason) => {
          item.reject(reason)
        })
        .finally(() => {
          this.inFlight.delete(item.key)
          this.activeCount--
          if (isMedia) this.activeMediaCount--
          this.pump()
        })
    }
  }

  private takeNextItem(): QueueItem | null {
    let selected: QueueItem | null = null
    for (const item of this.queued.values()) {
      const isMedia = item.asset.kind !== 'image'
      if (isMedia && this.activeMediaCount >= this.maxConcurrentMedia) continue
      if (
        !selected ||
        item.priority < selected.priority ||
        (item.priority === selected.priority && item.order < selected.order)
      ) {
        selected = item
      }
    }
    return selected
  }

  private retain(key: string, resource: unknown) {
    if (resource == null || this.retainedLimit === 0) return
    this.retained.delete(key)
    this.retained.set(key, resource)
    while (this.retained.size > this.retainedLimit) {
      const oldestKey = this.retained.keys().next().value as string | undefined
      if (!oldestKey) break
      this.retained.delete(oldestKey)
    }
  }
}

function canonicalAssetKey(src: string): string {
  const trimmed = src.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
  try {
    const base = typeof document === 'undefined' ? 'http://game.local/' : document.baseURI
    const url = new URL(trimmed, base)
    url.hash = ''
    return url.href
  } catch {
    return trimmed
  }
}

function scheduleBrowserWork(run: () => void, priority: number) {
  if (priority <= 0) {
    queueMicrotask(run)
    return
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number
  }
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(run, { timeout: priority === 1 ? 800 : 2_000 })
    return
  }
  window.setTimeout(run, priority === 1 ? 0 : 80)
}

async function loadBrowserAsset(asset: GamePreloadAsset): Promise<unknown> {
  if (asset.kind === 'image') return loadImage(asset.src)
  return loadMedia(asset.kind, asset.src)
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  if ('fetchPriority' in image) image.fetchPriority = 'low'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Could not preload image: ${src}`))
    image.src = src
  })

  try {
    await image.decode()
  } catch {
    // Some browsers reject decode() for otherwise usable SVG/data images.
    // onload above is sufficient to prove the resource is available.
  }
  return image
}

function loadMedia(kind: 'audio' | 'video', src: string): Promise<HTMLMediaElement> {
  const media = document.createElement(kind)
  media.preload = 'auto'
  if (kind === 'video') {
    const video = media as HTMLVideoElement
    video.muted = true
    video.playsInline = true
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(false), 30_000)
    const finish = (loaded: boolean) => {
      window.clearTimeout(timeout)
      media.removeEventListener('canplay', handleReady)
      media.removeEventListener('loadeddata', handleReady)
      media.removeEventListener('error', handleError)
      if (loaded) resolve(media)
      else reject(new Error(`Could not preload ${kind}: ${src}`))
    }
    const handleReady = () => finish(true)
    const handleError = () => finish(false)
    media.addEventListener('canplay', handleReady, { once: true })
    media.addEventListener('loadeddata', handleReady, { once: true })
    media.addEventListener('error', handleError, { once: true })
    media.src = src
    media.load()
  })
}

export const gameAssetPreloader = new GameAssetPreloader()
