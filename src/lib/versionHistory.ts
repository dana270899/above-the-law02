import type { SavedGraph } from './editorStorage'

/**
 * VERSION HISTORY
 * File-backed snapshots for the editor graph.
 *
 * In local development, Vite exposes /api/editor-versions and writes
 * timestamped JSON files under data/versions/. Those files are the real
 * recovery/history artifacts. The live graph is stored separately at
 * data/editor-state-current.json.
 */

const API_VERSIONS_URL = '/api/editor-versions'

export interface GameVersion {
  /** Timestamp-based id, safe for filenames. */
  id: string
  /** Human label. Auto-snapshots use a generated name. */
  name: string
  /** ISO timestamp the snapshot was taken. */
  createdAt: string
  /** True when created by the editor, not directly by the user. */
  auto: boolean
  /** Timestamped filename written under data/versions/. */
  filename?: string
  /** Immutable snapshot of the graph at the time of capture. */
  graph: SavedGraph
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Editor version request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

/** All versions, newest first. */
export async function listVersions(): Promise<GameVersion[]> {
  const store = await requestJson<{ versions: GameVersion[] }>(API_VERSIONS_URL)
  return store.versions
}

/**
 * Append a new timestamped version JSON file. Returns the saved record.
 * `name` is trimmed by the server; if empty, it falls back to a date label.
 */
export async function saveVersion(
  name: string,
  graph: SavedGraph,
  opts: { auto?: boolean } = {},
): Promise<GameVersion> {
  return requestJson<GameVersion>(API_VERSIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, graph, auto: !!opts.auto }),
  })
}

export async function deleteVersion(id: string): Promise<void> {
  await requestJson<{ ok: true }>(`${API_VERSIONS_URL}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function renameVersion(id: string, name: string): Promise<void> {
  await requestJson<GameVersion>(`${API_VERSIONS_URL}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

/** True when at least one timestamped JSON version exists. */
export async function hasAnyVersion(): Promise<boolean> {
  return (await listVersions()).length > 0
}
