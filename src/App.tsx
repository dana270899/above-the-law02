import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import { EditorPage } from '@/pages/EditorPage'
import { GamePage } from '@/pages/GamePage'
import { DesktopPage } from '@/pages/DesktopPage'
import { LoginPage } from '@/pages/LoginPage'
import { WinScreenComponent } from '@/components/game/WinScreen'
import { useGameScale } from '@/hooks/useGameScale'

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DesktopPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/editor" element={<EditorPage />} />
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
      </Routes>
    </BrowserRouter>
  )
}
