import { MAX_SECRET, MIN_SECRET } from '@game/api'
import { useGame } from '../hooks/useGame'
import { useGuessForm } from '../hooks/useGuessForm'
import { FeedbackBanner } from './feedbackBanner'
import { GameFooter } from './gameFooter'
import { GuessFormFields } from './guessForm'

type GameBoardProps = {
  onNewGame: () => void
}

export const GameBoard = ({ onNewGame }: GameBoardProps) => {
  const { feedback, attempts, hasWon, isStarting, isReady, makeGuess } = useGame()
  const form = useGuessForm({ onGuess: makeGuess })

  const isBusy = isStarting || form.isSubmitting
  const isFormDisabled = !isReady || hasWon || isBusy

  return (
    <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header>
        <h1 className="text-2xl font-bold">Game</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          I picked a number between {MIN_SECRET} and {MAX_SECRET}.
        </p>
      </header>

      <FeedbackBanner feedback={feedback} />
      <GuessFormFields form={form} isDisabled={isFormDisabled} />
      <GameFooter attempts={attempts} isBusy={isBusy} onNewGame={onNewGame} />
    </main>
  )
}
