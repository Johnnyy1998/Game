import type { GuessOutcome } from '@game/api'
import { useCallback, useEffect, useState } from 'react'
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

const unexpectedErrorFeedback: Feedback = {
  tone: 'error',
  text: 'Something went wrong. Please try again.',
}

// Owns one game round. Mount the consumer with a fresh `key` to start a new round.
export const useGame = () => {
  const [gameId, setGameId] = useState<string>()
  const [feedback, setFeedback] = useState<Feedback>({ tone: 'info', text: 'Starting a game…' })
  const [attempts, setAttempts] = useState(0)
  const [isStarting, setIsStarting] = useState(true)
  const [hasWon, setHasWon] = useState(false)

  useEffect(() => {
    let isMounted = true

    const beginGame = async () => {
      try {
        const result = await startGame()

        if (!isMounted) return

        if (result.isOk) {
          setGameId(result.data.gameId)
          setFeedback({ tone: 'info', text: result.data.message })
        } else {
          setFeedback({ tone: 'error', text: result.message })
        }
      } catch {
        if (isMounted) setFeedback(unexpectedErrorFeedback)
      } finally {
        if (isMounted) setIsStarting(false)
      }
    }

    void beginGame()

    return () => {
      isMounted = false
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
    makeGuess,
  }
}
