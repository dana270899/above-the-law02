import React from 'react'
import ReactDOM from 'react-dom/client'
import { GameContentProvider } from '@/components/game/GameContentProvider'
import { ReadOnlyStudioPage } from '@/pages/ReadOnlyStudioPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameContentProvider>
      <ReadOnlyStudioPage />
    </GameContentProvider>
  </React.StrictMode>,
)
