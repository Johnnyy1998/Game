import { MAX_SECRET, MIN_SECRET } from '@game/api'
import { useGame } from '../hooks/useGame'
import { useGuessForm } from '../hooks/useGuessForm'
import { FeedbackBanner } from './feedbackBanner'
import { GameFooter } from './gameFooter'
import { GuessFormFields } from './guessForm'

export const GameBoard = () => {
  const { feedback, attempts, hasWon, isStarting, isReady, beginGame, makeGuess } = useGame()
  const form = useGuessForm({ onGuess: makeGuess })

  const isBusy = isStarting || form.isSubmitting

  const startNewGame = () => {
    form.resetForm()
    void beginGame()
  }

  return (
    <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header>
        <h1 className="text-2xl font-bold">Game</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          I pick a number between {MIN_SECRET} and {MAX_SECRET}.
        </p>
      </header>

      <FeedbackBanner feedback={feedback} />
      {isReady && <GuessFormFields form={form} isDisabled={hasWon || isBusy} />}
      <GameFooter
        attempts={attempts}
        isBusy={isBusy}
        hasStarted={isReady}
        onNewGame={startNewGame}
      />
    </main>
  )
}
