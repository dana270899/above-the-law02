import type { CaseScoreBreakdown, RunScore } from '@/lib/scoring'

export interface LeaderboardEntry {
  id: string
  playerName: string
  photoUrl: string | null
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
const headers = () => ({ apikey: key ?? '', Authorization: `Bearer ${key ?? ''}` })

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

async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path || !url || !key) return null
  const response = await fetch(`${url}/storage/v1/object/sign/leaderboard-photos/${path}`, {
    method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (!response.ok) return null
  const data = await response.json() as { signedURL?: string; signedUrl?: string }
  const signed = data.signedURL ?? data.signedUrl
  return signed ? `${url}/storage/v1${signed}` : null
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!url || !key) return []
  const response = await fetch(`${url}/rest/v1/leaderboard_entries?select=*&order=score.desc,created_at.asc&limit=100`, { headers: headers() })
  if (!response.ok) throw new Error('Leaderboard is temporarily unavailable.')
  const rows = await response.json() as Array<Record<string, unknown>>
  const mapped = await Promise.all(rows.map(async (row) => ({
    id: String(row.id),
    playerName: String(row.player_name),
    photoUrl: await signedPhotoUrl(typeof row.photo_path === 'string' ? row.photo_path : null),
    score: Number(row.score),
    won: Boolean(row.won),
    caseBreakdown: (row.case_breakdown ?? []) as CaseScoreBreakdown[],
    createdAt: String(row.created_at),
  })))
  return rankEntries(mapped)
}

async function uploadPhoto(photo: Blob): Promise<string> {
  if (!url || !key) throw new Error('Leaderboard is not configured.')
  const path = `profiles/${crypto.randomUUID()}.jpg`
  const response = await fetch(`${url}/storage/v1/object/leaderboard-photos/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': photo.type || 'image/jpeg', 'x-upsert': 'false' },
    body: photo,
  })
  if (!response.ok) throw new Error('Could not upload the profile photo.')
  return path
}

export async function publishLeaderboardEntry(args: { playerName: string; photo?: Blob | null; run: RunScore }): Promise<LeaderboardEntry> {
  if (!url || !key) throw new Error('Leaderboard is not configured.')
  const photoPath = args.photo ? await uploadPhoto(args.photo) : null
  const response = await fetch(`${url}/rest/v1/leaderboard_entries`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ player_name: args.playerName, photo_path: photoPath, score: args.run.total, winning_target: args.run.target, won: args.run.won, case_breakdown: args.run.cases }),
  })
  if (!response.ok) throw new Error('Could not publish your score.')
  const [row] = await response.json() as Array<Record<string, unknown>>
  return {
    id: String(row.id), playerName: String(row.player_name), photoUrl: await signedPhotoUrl(photoPath),
    score: Number(row.score), won: Boolean(row.won),
    caseBreakdown: (row.case_breakdown ?? []) as CaseScoreBreakdown[], createdAt: String(row.created_at),
    isCurrentPlayer: true,
  }
}

export function mergeLocalPlayer(entries: LeaderboardEntry[], local: LeaderboardEntry) {
  const merged = [...entries, local].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
  return rankEntries(merged)
}
