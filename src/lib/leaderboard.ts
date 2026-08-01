import type { CaseScoreBreakdown, RunScore } from '@/lib/scoring'

export interface LeaderboardEntry {
  id: string
  playerName: string
  photoUrl: string | null
  photoPath?: string | null
  score: number
  won: boolean
  caseBreakdown: CaseScoreBreakdown[]
  createdAt: string
  rank?: number
  isCurrentPlayer?: boolean
}

export interface LeaderboardDisplay {
  ranked: LeaderboardEntry[]
  visible: LeaderboardEntry[]
  currentPlayer: LeaderboardEntry | null
}

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
const headers = () => ({
  apikey: key ?? '',
  ...(key && !key.startsWith('sb_publishable_')
    ? { Authorization: `Bearer ${key}` }
    : {}),
})

type ProfilePhotoUploadFormat = {
  extension: 'jpg' | 'png' | 'webp'
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export type FetchLeaderboardOptions = {
  /** Total attempts, including the first request. */
  attempts?: number
  /** Base delay between attempts; each retry waits one additional base unit. */
  retryDelayMs?: number
}

const TRANSIENT_LEADERBOARD_STATUSES = new Set([408, 429, 500, 502, 503, 504, 520])
const DEFAULT_LEADERBOARD_FETCH_ATTEMPTS = 3
const DEFAULT_LEADERBOARD_RETRY_DELAY_MS = 250

function waitForRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
}

export function getProfilePhotoUploadFormat(mimeType: string): ProfilePhotoUploadFormat | null {
  switch (mimeType.toLowerCase().split(';', 1)[0].trim()) {
    case 'image/jpeg':
    case 'image/jpg':
      return { extension: 'jpg', contentType: 'image/jpeg' }
    case 'image/png':
      return { extension: 'png', contentType: 'image/png' }
    case 'image/webp':
      return { extension: 'webp', contentType: 'image/webp' }
    default:
      return null
  }
}

async function rasterizeSvg(photo: Blob): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(photo)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Could not prepare the SVG profile photo.'))
      element.src = sourceUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, image.naturalWidth || 512)
    canvas.height = Math.max(1, image.naturalHeight || 512)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the profile photo.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('Could not prepare the profile photo.'))
      }, 'image/png')
    })
    return png
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function prepareProfilePhoto(photo: Blob): Promise<{ photo: Blob } & ProfilePhotoUploadFormat> {
  const directFormat = getProfilePhotoUploadFormat(photo.type)
  if (directFormat) return { photo, ...directFormat }
  if (photo.type.toLowerCase().split(';', 1)[0].trim() === 'image/svg+xml') {
    return { photo: await rasterizeSvg(photo), extension: 'png', contentType: 'image/png' }
  }
  throw new Error('The selected profile photo type is not supported.')
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: string } | null
  return new Error(body?.message || fallback)
}

export function isLeaderboardConfigured() {
  return !!url && !!key
}

export function rankEntries(entries: LeaderboardEntry[]) {
  let previousScore: number | null = null
  let rank = 0
  return entries.map((entry, index) => {
    if (entry.score !== previousScore) rank = index + 1
    previousScore = entry.score
    return { ...entry, rank }
  })
}

export function buildLeaderboardDisplay(
  entries: LeaderboardEntry[],
  currentPlayerId: string,
  limit = 10,
): LeaderboardDisplay {
  const ranked = rankEntries(
    [...entries].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt)),
  )
  const currentPlayer = ranked.find((entry) => entry.id === currentPlayerId) ?? null
  const visible = ranked.slice(0, limit)
  if (currentPlayer && !visible.some((entry) => entry.id === currentPlayer.id)) {
    visible.push(currentPlayer)
  }
  return { ranked, visible, currentPlayer }
}

export async function fetchLeaderboardPhotoUrl(path: string | null): Promise<string | null> {
  if (!path || !url || !key) return null
  const response = await fetch(`${url}/storage/v1/object/sign/leaderboard-photos/${path}`, {
    method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (!response.ok) return null
  const data = await response.json() as { signedURL?: string; signedUrl?: string }
  const signed = data.signedURL ?? data.signedUrl
  return signed ? `${url}/storage/v1${signed}` : null
}

export async function fetchLeaderboard(
  limit = 100,
  options: FetchLeaderboardOptions = {},
): Promise<LeaderboardEntry[]> {
  if (!url || !key) return []
  const resultLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(100, Math.trunc(limit)))
    : 100
  const attempts = Math.max(
    1,
    Math.min(5, Math.trunc(options.attempts ?? DEFAULT_LEADERBOARD_FETCH_ATTEMPTS)),
  )
  const retryDelayMs = Math.max(
    0,
    Math.min(2_000, Math.trunc(options.retryDelayMs ?? DEFAULT_LEADERBOARD_RETRY_DELAY_MS)),
  )

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response
    try {
      response = await fetch(
        `${url}/rest/v1/leaderboard_entries?select=*&order=score.desc,created_at.asc&limit=${resultLimit}`,
        { headers: headers() },
      )
    } catch (reason) {
      if (attempt >= attempts) throw reason
      await waitForRetry(retryDelayMs * attempt)
      continue
    }

    if (!response.ok) {
      const error = await responseError(response, 'Leaderboard is temporarily unavailable.')
      const canRetry = TRANSIENT_LEADERBOARD_STATUSES.has(response.status) && attempt < attempts
      if (!canRetry) throw error
      await waitForRetry(retryDelayMs * attempt)
      continue
    }

    try {
      const rows = await response.json() as Array<Record<string, unknown>>
      const mapped = rows.map((row) => ({
        id: String(row.id),
        playerName: String(row.player_name),
        photoUrl: null,
        photoPath: typeof row.photo_path === 'string' ? row.photo_path : null,
        score: Number(row.score),
        won: Boolean(row.won),
        caseBreakdown: (row.case_breakdown ?? []) as CaseScoreBreakdown[],
        createdAt: String(row.created_at),
      }))
      return rankEntries(mapped)
    } catch (reason) {
      if (attempt >= attempts) throw reason
      await waitForRetry(retryDelayMs * attempt)
    }
  }

  throw new Error('Leaderboard is temporarily unavailable.')
}

async function uploadPhoto(photo: Blob): Promise<string> {
  if (!url || !key) throw new Error('Leaderboard is not configured.')
  const prepared = await prepareProfilePhoto(photo)
  const path = `profiles/${crypto.randomUUID()}.${prepared.extension}`
  const response = await fetch(`${url}/storage/v1/object/leaderboard-photos/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': prepared.contentType, 'x-upsert': 'false' },
    body: prepared.photo,
  })
  if (!response.ok) throw await responseError(response, 'Could not upload the profile photo.')
  return path
}

export async function publishLeaderboardEntry(args: { playerName: string; photo?: Blob | null; run: RunScore }): Promise<LeaderboardEntry> {
  if (!url || !key) throw new Error('Leaderboard is not configured.')
  let photoPath: string | null = null
  if (args.photo) {
    try {
      photoPath = await uploadPhoto(args.photo)
    } catch (reason) {
      console.warn('The score will be saved without a profile photo.', reason)
    }
  }
  const response = await fetch(`${url}/rest/v1/leaderboard_entries`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(leaderboardInsertPayload({
      playerName: args.playerName,
      photoPath,
      run: args.run,
    })),
  })
  if (!response.ok) throw await responseError(response, 'Could not publish your score.')
  const [row] = await response.json() as Array<Record<string, unknown>>
  return {
    id: String(row.id), playerName: String(row.player_name), photoUrl: null, photoPath,
    score: Number(row.score), won: Boolean(row.won),
    caseBreakdown: (row.case_breakdown ?? []) as CaseScoreBreakdown[], createdAt: String(row.created_at),
    isCurrentPlayer: true,
  }
}

export function mergeLocalPlayer(entries: LeaderboardEntry[], local: LeaderboardEntry) {
  const merged = [...entries, local].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
  return rankEntries(merged)
}

export function leaderboardInsertPayload(args: { playerName: string; photoPath: string | null; run: RunScore }) {
  return {
    player_name: args.playerName,
    photo_path: args.photoPath,
    score: args.run.total,
    winning_target: args.run.target,
    won: args.run.won,
    case_breakdown: args.run.cases,
    mini_game_points: args.run.miniGamePoints ?? 0,
  }
}
