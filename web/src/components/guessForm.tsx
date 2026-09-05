import type { GuessForm } from '../hooks/useGuessForm'

type GuessFormProps = {
  form: GuessForm
  isDisabled: boolean
}

const focusRingClassName =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500'

export const GuessFormFields = ({ form, isDisabled }: GuessFormProps) => (
  // noValidate hands validation to Formik and Zod instead of the browser.
  <form className="mt-5 grid gap-2" noValidate onSubmit={form.handleSubmit}>
    <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="guess">
      Your guess
    </label>
    <input
      id="guess"
      name="guess"
      className={`rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700 ${focusRingClassName}`}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={form.values.guess}
      onChange={form.handleChange}
      disabled={isDisabled}
    />
    {form.errors.guess && (
      <p className="text-xs text-red-600 dark:text-red-400" role="alert">
        {form.errors.guess}
      </p>
    )}
    <button
      className={`rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-55 ${focusRingClassName}`}
      type="submit"
      disabled={isDisabled}
    >
      {form.isSubmitting ? 'Working…' : 'Guess'}
    </button>
  </form>
)
