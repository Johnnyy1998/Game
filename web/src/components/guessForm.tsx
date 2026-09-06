import type { GuessForm } from '../hooks/useGuessForm'
import { focusRingClassName, primaryButtonClassName } from './styles'

type GuessFormProps = {
  form: GuessForm
  isDisabled: boolean
}

export const GuessFormFields = ({ form, isDisabled }: GuessFormProps) => (
  // noValidate hands validation to Formik and Zod instead of the browser.
  <form className="mt-5 grid gap-4" noValidate onSubmit={form.handleSubmit}>
    {/* The label and its error belong to the field, so they sit closer to it than the button. */}
    <div className="grid gap-1.5">
      <label className="text-slate-500 text-xs dark:text-slate-400" htmlFor="guess">
        Your guess
      </label>
      <input
        id="guess"
        name="guess"
        className={`rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-center font-medium text-lg tabular-nums dark:border-slate-700 ${focusRingClassName}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={form.values.guess}
        onChange={form.handleChange}
        disabled={isDisabled}
      />
      {form.errors.guess && (
        <p className="text-red-600 text-xs dark:text-red-400" role="alert">
          {form.errors.guess}
        </p>
      )}
    </div>
    <button className={primaryButtonClassName} type="submit" disabled={isDisabled}>
      {form.isSubmitting ? 'Working…' : 'Guess'}
    </button>
  </form>
)
