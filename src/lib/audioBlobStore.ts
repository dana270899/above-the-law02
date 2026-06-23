/**
 * AUDIO BLOB STORE
 *
 * Uploaded audio files (win-screen sounds, background music) are far
 * bigger than what localStorage can hold (5 MB hard quota). We keep
 * them in IndexedDB instead — the editor state only persists a short
 * blob id, and the runtime fetches the blob back when it needs to play.
 *
 * All operations are best-effort. If IndexedDB is unavailable (private
 * mode, very old browser) the helpers reject and the caller falls back
 * to whatever data URL is set on the node, or to silence.
 */

const DB_NAME = 'game-audio-store-v1'
const STORE_NAME = 'audio'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

/** Persist a blob under `id`. Resolves once the write completes. */
export async function saveAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB put aborted'))
  })
}

/** Load a previously saved blob. Resolves to `null` when missing. */
export async function loadAudioBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => {
      const v = req.result
      resolve(v instanceof Blob ? v : null)
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'))
  })
}

/** Best-effort delete. Errors are swallowed — the caller already
 *  removed the reference from the node, so a leftover blob is harmless. */
export async function removeAudioBlob(id: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    // ignore — orphaned blob is acceptable
  }
}

/** Generate a short unique id for a new blob. Not cryptographic — just
 *  unique enough across nodes in one project. */
export function makeAudioBlobId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `snd-${Date.now().toString(36)}-${rand}`
}

/** Generate a short unique id for a new image blob. Same store. */
export function makeImageBlobId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `img-${Date.now().toString(36)}-${rand}`
}
