import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import { EditorPage } from '@/pages/EditorPage'
import { GameSessionRoute } from '@/components/game/GameSessionRoute'
import { CreditsPage } from '@/pages/CreditsPage'
import { DesktopPage } from '@/pages/DesktopPage'
import { LoginPage } from '@/pages/LoginPage'
import { WinScreenComponent } from '@/components/game/WinScreen'
import { useGameScale } from '@/hooks/useGameScale'
import { assetUrl, routerBasename } from '@/lib/paths'
import { caseNumberForOrder } from '@/lib/caseOrder'
import { RankingPage } from '@/components/game/RankingPage/RankingPage'
import type { PlayerProfile, RunScore } from '@/lib/scoring'

const RANKING_START_PROFILE: PlayerProfile = {
  name: 'Officer',
  photo: null,
  photoPreviewUrl: null,
}

const RANKING_START_RUN: RunScore = {
  total: 0,
  target: 0,
  won: false,
  cases: [],
}

/** Standalone /win/* routes — scale the 1920×1080 canvas to fit the
 *  viewport, same as the live game. Used by the editor Components
 *  tab to preview each win screen inside an iframe. */
function WinScreenStage({ children }: { children: ReactNode }) {
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

/** Local authoring application. Production builds use GameApp instead. */
export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route
          path="/"
          element={
            <WinScreenStage>
              <RankingPage
                profile={RANKING_START_PROFILE}
                run={RANKING_START_RUN}
                entryMode
              />
            </WinScreenStage>
          }
        />
        <Route path="/desktop" element={<DesktopPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/game" element={<GameSessionRoute />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/ranking-preview" element={<WinScreenStage><RankingPage profile={{ name: 'Dana Officer', photo: null, photoPreviewUrl: assetUrl('/images/login-screen/Flower.svg') }} run={{ total: 280, target: 600, won: false, cases: [
          { caseId: caseNumberForOrder(1), title: 'Case 1', important: false, attempt: 2, correct: true, basePoints: 50, speedPoints: 18, elapsedSeconds: 76, totalPoints: 68 },
          { caseId: caseNumberForOrder(2), title: 'Case 2', important: false, attempt: 1, correct: true, basePoints: 100, speedPoints: 34, elapsedSeconds: 39, totalPoints: 134 },
          { caseId: caseNumberForOrder(3), title: 'Case 3', important: true, attempt: 1, correct: true, basePoints: 200, speedPoints: 42, elapsedSeconds: 18, totalPoints: 242 },
          { caseId: caseNumberForOrder(4), title: 'Case 4', important: false, attempt: 1, correct: false, basePoints: 0, speedPoints: 0, elapsedSeconds: 103, totalPoints: 0 },
          { caseId: caseNumberForOrder(5), title: 'Case 5', important: false, attempt: 1, correct: true, basePoints: 100, speedPoints: 21, elapsedSeconds: 70, totalPoints: 121 },
          { caseId: caseNumberForOrder(6), title: 'Case 6', important: true, attempt: 2, correct: true, basePoints: 100, speedPoints: 20, elapsedSeconds: 72, totalPoints: 120 },
          { caseId: caseNumberForOrder(7), title: 'Case 7', important: false, attempt: 2, correct: true, basePoints: 50, speedPoints: 0, elapsedSeconds: 131, totalPoints: 50 },
        ] }} /></WinScreenStage>} />
        {/* Route every standalone preview through the dispatcher so the
            entrance pop animation (and any future dispatcher-level
            wiring) plays consistently. */}
        <Route
          path="/win/graffiti"
          element={<WinScreenStage><WinScreenComponent variant="graffiti" /></WinScreenStage>}
        />
        <Route
          path="/win/punching-dummy"
          element={<WinScreenStage><WinScreenComponent variant="punching-dummy" /></WinScreenStage>}
        />
        <Route
          path="/win/punching-dummy-click"
          element={<WinScreenStage><WinScreenComponent variant="punching-dummy-click" /></WinScreenStage>}
        />
        <Route
          path="/win/kippah-cutting"
          element={<WinScreenStage><WinScreenComponent variant="kippah-cutting" /></WinScreenStage>}
        />
        <Route
          path="/win/kippah-cutting-workshop"
          element={<WinScreenStage><WinScreenComponent variant="kippah-cutting-workshop" /></WinScreenStage>}
        />
        <Route
          path="/win/bdsm-party"
          element={<WinScreenStage><WinScreenComponent variant="bdsm-party" /></WinScreenStage>}
        />
        <Route
          path="/win/pizza"
          element={<WinScreenStage><WinScreenComponent variant="pizza" /></WinScreenStage>}
        />
        <Route
          path="/win/picnic"
          element={<WinScreenStage><WinScreenComponent variant="picnic" /></WinScreenStage>}
        />
        <Route
          path="/win/eilat"
          element={<WinScreenStage><WinScreenComponent variant="eilat" /></WinScreenStage>}
        />
      </Routes>
    </BrowserRouter>
  )
}
