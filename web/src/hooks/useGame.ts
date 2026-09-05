import type { GuessOutcome } from '@game/api'
import { useCallback, useState } from 'react'
import { startGame, submitGuess } from '../gameClient'

export type FeedbackTone = 'info' | 'hint' | 'success' | 'error'

export type Feedback = {
  tone: FeedbackTone
  text: string
}

const toneByOutcome: Record<GuessOutcome, FeedbackTone> = {
  tooLow: 'hint',
  tooHigh: 'hint',
  correct: 'success',
}

const idleFeedback: Feedback = { tone: 'info', text: 'Press start when you are ready.' }

const startingFeedback: Feedback = { tone: 'info', text: 'Starting a game…' }

const unexpectedErrorFeedback: Feedback = {
  tone: 'error',
  text: 'Something went wrong. Please try again.',
}

// Owns one game round. Nothing is requested until `beginGame` is called, so opening
// the page does not create a game on the server.
export const useGame = () => {
  const [gameId, setGameId] = useState<string>()
  const [feedback, setFeedback] = useState<Feedback>(idleFeedback)
  const [attempts, setAttempts] = useState(0)
  const [isStarting, setIsStarting] = useState(false)
  const [hasWon, setHasWon] = useState(false)

  const beginGame = useCallback(async () => {
    setIsStarting(true)
    setGameId(undefined)
    setAttempts(0)
    setHasWon(false)
    setFeedback(startingFeedback)

    try {
      const result = await startGame()

      if (result.isOk) {
        setGameId(result.data.gameId)
        setFeedback({ tone: 'info', text: result.data.message })
      } else {
        setFeedback({ tone: 'error', text: result.message })
      }
    } catch {
      setFeedback(unexpectedErrorFeedback)
    } finally {
      setIsStarting(false)
    }
  }, [])

  const makeGuess = useCallback(
    async (guess: number) => {
      if (!gameId) return false

      try {
        const result = await submitGuess(gameId, guess)

        if (!result.isOk) {
          setFeedback({ tone: 'error', text: result.message })
          return false
        }

        setFeedback({ tone: toneByOutcome[result.data.outcome], text: result.data.message })
        setAttempts(result.data.attempts)
        setHasWon(result.data.outcome === 'correct')
        return true
      } catch {
        setFeedback(unexpectedErrorFeedback)
        return false
      }
    },
    [gameId],
  )

  return {
    feedback,
    attempts,
    hasWon,
    isStarting,
    isReady: gameId !== undefined,
    beginGame,
    makeGuess,
  }
}
