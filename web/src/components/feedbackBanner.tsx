import type { Feedback, FeedbackTone } from '../hooks/useGame'

type FeedbackBannerProps = {
  feedback: Feedback
}

const classNameByTone: Record<FeedbackTone, string> = {
  info: 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400',
  hint: 'border-amber-400 text-amber-700 dark:border-amber-500/60 dark:text-amber-300',
  success: 'border-emerald-500 text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-300',
  error: 'border-red-500 text-red-700 dark:border-red-500/60 dark:text-red-300',
}

export const FeedbackBanner = ({ feedback }: FeedbackBannerProps) => (
  <p
    className={`mt-5 rounded-xl border px-4 py-3 text-[0.95rem] ${classNameByTone[feedback.tone]}`}
    role="status"
  >
    {feedback.text}
  </p>
)
