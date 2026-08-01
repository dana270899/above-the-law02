import { useLocation } from 'react-router-dom'
import { GamePage } from '@/pages/GamePage'

/**
 * Every navigation to /game receives a new router location key. Keying the
 * page by it produces a genuinely fresh run while providers and module-level
 * preload caches above the route stay alive.
 */
export function GameSessionRoute() {
  const location = useLocation()
  return <GamePage key={location.key} />
}
