import { describe, expect, it } from 'vitest'
import {
  buildLeaderboardDisplay,
  getProfilePhotoUploadFormat,
  mergeLocalPlayer,
  type LeaderboardEntry,
} from './leaderboard'

function entry(id: string, score: number, createdAt: string, current = false): LeaderboardEntry {
  return { id, playerName: id, photoUrl: null, score, won: true, caseBreakdown: [], createdAt, isCurrentPlayer: current }
}

describe('leaderboard display', () => {
  it('orders scores descending, uses shared ranks for ties, and time for deterministic ordering', () => {
    const display = buildLeaderboardDisplay([
      entry('later', 200, '2026-01-02T00:00:00Z'),
      entry('lower', 100, '2026-01-01T00:00:00Z'),
      entry('earlier', 200, '2026-01-01T00:00:00Z'),
    ], 'lower')
    expect(display.ranked.map(({ id, rank }) => [id, rank])).toEqual([
      ['earlier', 1], ['later', 1], ['lower', 3],
    ])
  })

  it('shows the top ten plus the player when they are outside it', () => {
    const rows = Array.from({ length: 12 }, (_, index) => entry(`p${index + 1}`, 120 - index, `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`, index === 11))
    const display = buildLeaderboardDisplay(rows, 'p12')
    expect(display.visible).toHaveLength(11)
    expect(display.visible[display.visible.length - 1]).toMatchObject({ id: 'p12', rank: 12 })
  })

  it('keeps a declined/offline player as a local-only ranked row', () => {
    const local = entry('local-player', 150, '2026-01-03T00:00:00Z', true)
    const merged = mergeLocalPlayer([entry('public', 200, '2026-01-01T00:00:00Z')], local)
    expect(merged).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'local-player', isCurrentPlayer: true, rank: 2 }),
    ]))
  })
})

describe('leaderboard profile photos', () => {
  it('keeps each supported image MIME type aligned with its stored extension', () => {
    expect(getProfilePhotoUploadFormat('image/jpeg')).toEqual({ extension: 'jpg', contentType: 'image/jpeg' })
    expect(getProfilePhotoUploadFormat('image/png')).toEqual({ extension: 'png', contentType: 'image/png' })
    expect(getProfilePhotoUploadFormat('image/webp')).toEqual({ extension: 'webp', contentType: 'image/webp' })
  })

  it('requires SVG profile art to be rasterized before upload', () => {
    expect(getProfilePhotoUploadFormat('image/svg+xml')).toBeNull()
  })
})
