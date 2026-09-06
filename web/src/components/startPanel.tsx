import { MAX_SECRET, MIN_SECRET } from '@game/api'
import type { Feedback } from '../hooks/useGame'
import { primaryButtonClassName } from './styles'

type StartPanelProps = {
  feedback: Feedback
  isStarting: boolean
  onStart: () => void
}

export const StartPanel = ({ feedback, isStarting, onStart }: StartPanelProps) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
    <div className="grid gap-2">
      <p className="text-balance font-medium text-lg">
        I picked a number between {MIN_SECRET} and {MAX_SECRET}.
      </p>
      <p
        className={`text-sm ${
          feedback.tone === 'error'
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-500 dark:text-slate-400'
        }`}
        role="status"
      >
        {feedback.text}
      </p>
    </div>
    <button
      className={`w-full ${primaryButtonClassName}`}
      type="button"
      onClick={onStart}
      disabled={isStarting}
    >
      {isStarting ? 'Starting…' : 'Start game'}
    </button>
  </div>
)
