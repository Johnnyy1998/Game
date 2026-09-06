import { useGame } from '../hooks/useGame'
import { useGuessForm } from '../hooks/useGuessForm'
import { FeedbackBanner } from './feedbackBanner'
import { GameFooter } from './gameFooter'
import { GuessFormFields } from './guessForm'
import { StartPanel } from './startPanel'

export const GameBoard = () => {
  const { feedback, attempts, hasWon, isStarting, isReady, beginGame, makeGuess } = useGame()
  const form = useGuessForm({ onGuess: makeGuess })

  const isBusy = isStarting || form.isSubmitting

  const startNewGame = () => {
    form.resetForm()
    void beginGame()
  }

  return (
    // The minimum height keeps the card the same size before and during a game.
    <main className="flex min-h-100 w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="font-bold text-2xl tracking-tight">Game</h1>

      {isReady ? (
        <>
          <FeedbackBanner feedback={feedback} />
          <GuessFormFields form={form} isDisabled={hasWon || isBusy} />
          <GameFooter attempts={attempts} isBusy={isBusy} onNewGame={startNewGame} />
        </>
      ) : (
        <StartPanel feedback={feedback} isStarting={isStarting} onStart={startNewGame} />
      )}
    </main>
  )
}
