import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GamePage } from '@/pages/GamePage'
import { RankingPage } from '@/components/game/RankingPage/RankingPage'
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

/** Public application: deliberately contains only the playable game. */
export default function GameApp() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<RankingEntryPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
