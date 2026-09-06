import { secondaryButtonClassName } from './styles'

type GameFooterProps = {
  attempts: number
  isBusy: boolean
  onNewGame: () => void
}

export const GameFooter = ({ attempts, isBusy, onNewGame }: GameFooterProps) => (
  <footer className="mt-auto flex items-center justify-between pt-5 text-slate-500 text-sm dark:text-slate-400">
    <span>
      Attempts: <span className="font-medium text-slate-700 dark:text-slate-200">{attempts}</span>
    </span>
    <button
      className={secondaryButtonClassName}
      type="button"
      onClick={onNewGame}
      disabled={isBusy}
    >
      New game
    </button>
  </footer>
)
