import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PlayerProfile, RunScore } from '@/lib/scoring'
import {
  buildLeaderboardDisplay,
  fetchLeaderboard,
  isLeaderboardConfigured,
  mergeLocalPlayer,
  publishLeaderboardEntry,
  type LeaderboardEntry,
} from '@/lib/leaderboard'
import { assetUrl } from '@/lib/paths'
import { ScorePublishScreen } from '@/components/game/ScorePublishScreen/ScorePublishScreen'
import styles from './RankingPage.module.css'

const publicationRequests = new Map<string, Promise<LeaderboardEntry>>()
const RANKING_SKELETON_ROWS = 6

async function preloadVisibleLeaderboardPhotos(entries: LeaderboardEntry[], currentPlayerId = '') {
  const { visible } = buildLeaderboardDisplay(entries, currentPlayerId)
  const photoUrls = [...new Set(visible.flatMap((entry) => entry.photoUrl ? [entry.photoUrl] : []))]
  const results = await Promise.all(photoUrls.map((photoUrl) => new Promise<[string, boolean]>((resolve) => {
    const image = new Image()
    image.onload = () => {
      void image.decode().then(
        () => resolve([photoUrl, true]),
        () => resolve([photoUrl, false]),
      )
    }
    image.onerror = () => resolve([photoUrl, false])
    image.src = photoUrl
  })))
  const failedUrls = new Set(results.filter(([, loaded]) => !loaded).map(([photoUrl]) => photoUrl))
  return entries.map((entry) => entry.photoUrl && failedUrls.has(entry.photoUrl)
    ? { ...entry, photoUrl: null }
    : entry)
}

function publicationRequest(key: string, profile: PlayerProfile, run: RunScore) {
  const existing = publicationRequests.get(key)
  if (existing) return existing
  const request = publishLeaderboardEntry({
    playerName: profile.name,
    photo: profile.photo,
    run,
  }).catch((reason) => {
    publicationRequests.delete(key)
    throw reason
  })
  publicationRequests.set(key, request)
  return request
}

export function RankingPage({
  profile,
  run,
  entryMode = false,
  publicationKey,
  onProfileChange,
}: {
  profile: PlayerProfile
  run: RunScore
  entryMode?: boolean
  publicationKey?: string
  onProfileChange?: (profile: PlayerProfile) => void
}) {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'publishing' | 'published' | 'history-error' | 'error'>('loading')
  const [error, setError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [publicationProfile, setPublicationProfile] = useState<PlayerProfile | null>(entryMode ? profile : null)
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const scrollTrackRef = useRef<HTMLDivElement | null>(null)
  const [scrollMetrics, setScrollMetrics] = useState({ top: 0, height: 0, atStart: true, atEnd: true })
  const effectiveProfile = publicationProfile ?? profile

  const localEntry = useMemo<LeaderboardEntry>(() => ({
    id: 'local-player',
    playerName: effectiveProfile.name,
    photoUrl: effectiveProfile.photoPreviewUrl ?? null,
    score: run.total,
    won: run.won,
    caseBreakdown: run.cases,
    createdAt: new Date().toISOString(),
    isCurrentPlayer: true,
  }), [effectiveProfile, run])

  useEffect(() => {
    let active = true
    async function loadAndPublish() {
      try {
        setError('')
        if (entryMode) {
          const remoteEntries = await preloadVisibleLeaderboardPhotos(await fetchLeaderboard(10))
          if (!active) return
          setEntries(remoteEntries)
          setStatus('ready')
          return
        }
        if (!publicationProfile) return
        if (!isLeaderboardConfigured()) {
          throw new Error('Shared ranking is not configured.')
        }
        setStatus('publishing')
        const key = publicationKey ?? `${effectiveProfile.name}:${run.total}:${JSON.stringify(run.cases)}`
        const remoteRequest = fetchLeaderboard()
        const [remoteResult, publicationResult] = await Promise.allSettled([
          remoteRequest,
          publicationRequest(key, effectiveProfile, run),
        ])
        if (publicationResult.status === 'rejected') throw publicationResult.reason
        const published = publicationResult.value
        if (!active) return
        if (remoteResult.status === 'rejected') {
          console.warn('The latest shared ranking could not be loaded.', remoteResult.reason)
          const [preparedPublished] = await preloadVisibleLeaderboardPhotos([published], published.id)
          if (!active) return
          setEntries([preparedPublished])
          setError('Your score was saved, but previous rankings could not be loaded.')
          setStatus('history-error')
          return
        }
        const nextEntries = await preloadVisibleLeaderboardPhotos([
          ...remoteResult.value.filter((entry) => entry.id !== published.id),
          published,
        ], published.id)
        if (!active) return
        setEntries(nextEntries)
        setStatus('published')
      } catch (reason) {
        if (!active) return
        const message = reason instanceof Error ? reason.message : String(reason)
        console.warn('The score could not be added to the shared ranking; showing it locally.', message)
        setError(message)
        setStatus('error')
      }
    }
    void loadAndPublish()
    return () => { active = false }
  }, [effectiveProfile, entryMode, publicationKey, publicationProfile, run])

  const hasPublishedEntry = status === 'published' || status === 'history-error'
  const withCurrentPlayer = entryMode || hasPublishedEntry
    ? entries
    : mergeLocalPlayer(entries.filter((entry) => entry.id !== localEntry.id), localEntry)
  const currentPlayerId = entryMode
    ? ''
    : hasPublishedEntry
      ? entries.find((entry) => entry.isCurrentPlayer)?.id ?? localEntry.id
      : localEntry.id
  const { visible: shown } = buildLeaderboardDisplay(withCurrentPlayer, currentPlayerId)

  function syncScrollbar() {
    const rows = rowsRef.current
    const track = scrollTrackRef.current
    if (!rows || !track) return
    const maxScroll = Math.max(0, rows.scrollHeight - rows.clientHeight)
    const height = maxScroll === 0
      ? track.clientHeight
      : Math.max(48, track.clientHeight * (rows.clientHeight / rows.scrollHeight))
    const availableTrack = Math.max(0, track.clientHeight - height)
    const top = maxScroll === 0 ? 0 : (rows.scrollTop / maxScroll) * availableTrack
    setScrollMetrics({
      top,
      height,
      atStart: rows.scrollTop <= 1,
      atEnd: rows.scrollTop >= maxScroll - 1,
    })
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncScrollbar)
    window.addEventListener('resize', syncScrollbar)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', syncScrollbar)
    }
  }, [shown.length, status])

  if (!entryMode && !publicationProfile) {
    return (
      <ScorePublishScreen
        profile={profile}
        score={run.total}
        onPublish={(nextProfile) => {
          onProfileChange?.(nextProfile)
          setPublicationProfile(nextProfile)
        }}
      />
    )
  }

  function scrollRows(direction: -1 | 1) {
    rowsRef.current?.scrollBy({ top: direction * 94, behavior: 'smooth' })
  }

  function scrollFromTrack(clientY: number) {
    const rows = rowsRef.current
    const track = scrollTrackRef.current
    if (!rows || !track) return
    const maxScroll = Math.max(0, rows.scrollHeight - rows.clientHeight)
    const availableTrack = Math.max(1, track.clientHeight - scrollMetrics.height)
    const targetTop = clientY - track.getBoundingClientRect().top - (scrollMetrics.height / 2)
    rows.scrollTo({
      top: Math.max(0, Math.min(1, targetTop / availableTrack)) * maxScroll,
      behavior: 'smooth',
    })
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.blueBar} ${styles.blueBarTop}`} />
      <div className={`${styles.blueBar} ${styles.blueBarBottom}`} />

      <div className={styles.content}>
        <section className={styles.rankingColumn}>
          <h1 className={styles.title} data-text="Ranking">
            <span>Ranking</span>
          </h1>

          <div className={styles.board}>
            <div
              className={styles.rows}
              ref={rowsRef}
              onScroll={syncScrollbar}
              aria-busy={status === 'loading' || status === 'publishing'}
            >
              {shown.map((entry) => (
                <article
                  key={entry.id}
                  className={`${styles.row} ${entry.isCurrentPlayer ? styles.currentRow : ''}`}
                >
                  <span className={styles.rank}>{entry.rank}</span>
                  <span className={styles.playerPhoto}>
                    {entry.photoUrl ? (
                      <img src={entry.photoUrl} alt="" />
                    ) : (
                      <img
                        src={assetUrl('/images/Player.svg')}
                        alt=""
                        className={styles.defaultPlayerPhoto}
                      />
                    )}
                  </span>
                  <span className={styles.playerName}>{entry.playerName}</span>
                  <span className={styles.playerScore}>
                    {entry.score.toLocaleString('en-US')} points
                  </span>
                </article>
              ))}
              {status === 'loading' && (
                <div className={styles.skeletonRows} role="status" aria-label="Loading ranking">
                  {Array.from({ length: RANKING_SKELETON_ROWS }, (_, index) => (
                    <div className={`${styles.row} ${styles.skeletonRow}`} key={index} aria-hidden="true">
                      <span className={`${styles.skeletonBlock} ${styles.skeletonRank}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonPhoto}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonName}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonScore}`} />
                    </div>
                  ))}
                </div>
              )}
              {status === 'ready' && shown.length === 0 && <p className={styles.loading}>No saved results yet.</p>}
            </div>

            <div className={styles.scrollbar}>
              <button type="button" className={styles.scrollUp} disabled={scrollMetrics.atStart} onClick={() => scrollRows(-1)} aria-label="Scroll ranking up">
                <img src={assetUrl('/images/case-window/arrow-forward.svg')} alt="" aria-hidden="true" />
              </button>
              <div
                className={styles.scrollTrack}
                ref={scrollTrackRef}
                onClick={(event) => scrollFromTrack(event.clientY)}
              >
                <div
                  className={styles.scrollThumb}
                  style={{ top: scrollMetrics.top, height: scrollMetrics.height }}
                />
              </div>
              <button type="button" className={styles.scrollDown} disabled={scrollMetrics.atEnd} onClick={() => scrollRows(1)} aria-label="Scroll ranking down">
                <img src={assetUrl('/images/case-window/arrow-forward.svg')} alt="" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className={styles.illustrationColumn}>
          <div className={styles.illustrationFrame}>
            <img
              src={assetUrl('/images/Logo.svg')}
              alt=""
              className={styles.rankingBadge}
            />
            <img
              src={assetUrl('/images/ranking-board/Boss on Crocodile.svg')}
              alt=""
              className={styles.illustration}
            />
          </div>
          <div className={styles.ctas}>
            <button
              type="button"
              className={styles.playAgain}
              onClick={() => navigate('/game')}
            >
              {entryMode ? 'Start game' : 'Play again'}
            </button>
            <button
              type="button"
              className={styles.credits}
              onClick={() => navigate('/credits')}
            >
              About &amp; Credits
            </button>
          </div>
        </section>
      </div>

      {detailsOpen && (
        <div className={styles.modalLayer} role="presentation" onMouseDown={() => setDetailsOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Score details and privacy"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.modalClose} onClick={() => setDetailsOpen(false)} aria-label="Close">
              ×
            </button>
            <h2>{effectiveProfile.name}</h2>
            <p className={styles.modalScore}>{run.total.toLocaleString('en-US')} points</p>
            <div className={styles.breakdown}>
              {run.cases.map((item) => (
                <p key={item.caseId}>
                  <span>{item.title}</span>
                  <strong>+{item.totalPoints}</strong>
                </p>
              ))}
            </div>
            {!isLeaderboardConfigured() && <p className={styles.notice}>Shared ranking is not configured. Your result remains private.</p>}
            {status === 'publishing' && <p className={styles.notice}>Saving your result…</p>}
            {status === 'published' && <p className={styles.notice}>Your result was saved to the shared ranking.</p>}
            {error && <p className={styles.notice}>{error}</p>}
          </section>
        </div>
      )}
    </main>
  )
}
