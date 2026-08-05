import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CreditsPage } from '@/pages/CreditsPage'
import { GameContentProvider } from '@/components/game/GameContentProvider'
import { GameSessionRoute } from '@/components/game/GameSessionRoute'
import { MobileNotice } from '@/components/game/MobileNotice/MobileNotice'
import { RankingPage } from '@/components/game/RankingPage/RankingPage'
import { LoginScreen } from '@/components/game/LoginScreen/LoginScreen'
import { WinScreenComponent } from '@/components/game/WinScreen'
import { useGameScale } from '@/hooks/useGameScale'
import { routerBasename } from '@/lib/paths'
import type { PlayerProfile, RunScore } from '@/lib/scoring'

const ENTRY_PROFILE: PlayerProfile = {
  name: 'Officer',
  photo: null,
  photoPreviewUrl: null,
}

const ENTRY_RUN: RunScore = {
  total: 0,
  target: 0,
  won: false,
  cases: [],
}

const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse) and (max-width: 1024px)'

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}

function RankingEntryPage() {
  const ref = useGameScale()

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        width: 1920,
        height: 1080,
        transformOrigin: 'top left',
        overflow: 'hidden',
      }}
    >
      <RankingPage profile={ENTRY_PROFILE} run={ENTRY_RUN} entryMode />
    </div>
  )
}

function ShowcasePreviewStage({ children }: { children: ReactNode }) {
  const ref = useGameScale()

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        width: 1920,
        height: 1080,
        transformOrigin: 'top left',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

function PublicRoutes({ isMobile }: { isMobile: boolean }) {
  const location = useLocation()

  if (isMobile && location.pathname !== '/showcase') return <MobileNotice />

  return (
    <Routes>
      <Route path="/" element={<RankingEntryPage />} />
      <Route path="/game" element={<GameSessionRoute />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/login" element={<ShowcasePreviewStage><LoginScreen /></ShowcasePreviewStage>} />
      <Route path="/win/graffiti" element={<ShowcasePreviewStage><WinScreenComponent variant="graffiti" /></ShowcasePreviewStage>} />
      <Route path="/win/punching-dummy" element={<ShowcasePreviewStage><WinScreenComponent variant="punching-dummy" /></ShowcasePreviewStage>} />
      <Route path="/win/punching-dummy-click" element={<ShowcasePreviewStage><WinScreenComponent variant="punching-dummy-click" /></ShowcasePreviewStage>} />
      <Route path="/win/kippah-cutting" element={<ShowcasePreviewStage><WinScreenComponent variant="kippah-cutting" /></ShowcasePreviewStage>} />
      <Route path="/win/kippah-cutting-workshop" element={<ShowcasePreviewStage><WinScreenComponent variant="kippah-cutting-workshop" /></ShowcasePreviewStage>} />
      <Route path="/win/bdsm-party" element={<ShowcasePreviewStage><WinScreenComponent variant="bdsm-party" /></ShowcasePreviewStage>} />
      <Route path="/win/pizza" element={<ShowcasePreviewStage><WinScreenComponent variant="pizza" muteAudio /></ShowcasePreviewStage>} />
      <Route path="/win/picnic" element={<ShowcasePreviewStage><WinScreenComponent variant="picnic" /></ShowcasePreviewStage>} />
      <Route path="/win/eilat" element={<ShowcasePreviewStage><WinScreenComponent variant="eilat" /></ShowcasePreviewStage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** Public application: playable game plus a separate read-only showcase. */
export default function GameApp() {
  const isMobile = useMobileViewport()

  return (
    <GameContentProvider>
      <BrowserRouter basename={routerBasename}>
        <PublicRoutes isMobile={isMobile} />
      </BrowserRouter>
    </GameContentProvider>
  )
}
