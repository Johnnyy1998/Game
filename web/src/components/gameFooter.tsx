type GameFooterProps = {
  attempts: number
  isBusy: boolean
  onNewGame: () => void
}

export const GameFooter = ({ attempts, isBusy, onNewGame }: GameFooterProps) => (
  <footer className="mt-5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
    <span>Attempts: {attempts}</span>
    <button
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-indigo-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-800"
      type="button"
      onClick={onNewGame}
      disabled={isBusy}
    >
      New game
    </button>
  </footer>
)
