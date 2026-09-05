import { useCallback, useState } from 'react'
import { GameBoard } from './components/gameBoard'

// Bumping the round remounts the board, which resets all game state and starts a new game.
export const App = () => {
  const [round, setRound] = useState(0)

  const startNewGame = useCallback(() => setRound((current) => current + 1), [])

  return <GameBoard key={round} onNewGame={startNewGame} />
}
