import { MAX_SECRET, MIN_SECRET } from '@game/api'
import { useFormik } from 'formik'
import { z } from 'zod'

type GuessFormValues = { guess: string }

type UseGuessFormOptions = {
  onGuess: (guess: number) => Promise<boolean>
}

// The field stays text so Formik does not coerce it; the schema validates and converts in one step.
const guessFieldSchema = z
  .string()
  .refine(
    (value) =>
      /^\d+$/.test(value.trim()) && Number(value) >= MIN_SECRET && Number(value) <= MAX_SECRET,
    `Enter a whole number between ${MIN_SECRET} and ${MAX_SECRET}.`,
  )
  .transform(Number)

const validateGuessForm = ({ guess }: GuessFormValues) => {
  const parsed = guessFieldSchema.safeParse(guess)

  if (parsed.success) return {}

  return { guess: parsed.error.issues.map((issue) => issue.message).join(' ') }
}

export const useGuessForm = ({ onGuess }: UseGuessFormOptions) =>
  useFormik<GuessFormValues>({
    initialValues: { guess: '' },
    validateOnChange: false,
    validateOnBlur: false,
    validate: validateGuessForm,
    onSubmit: async ({ guess }, helpers) => {
      try {
        const wasAccepted = await onGuess(guessFieldSchema.parse(guess))

        if (wasAccepted) helpers.resetForm()
      } catch {
        helpers.setFieldError('guess', 'Could not submit your guess. Please try again.')
      }
    },
  })

export type GuessForm = ReturnType<typeof useGuessForm>
