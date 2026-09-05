import { ErrorResponseSchema, GuessResponseSchema, StartGameResponseSchema } from '@game/api'
import type { ZodType } from 'zod'

type ApiResult<T> = { isOk: true; data: T } | { isOk: false; message: string }

const genericMessage = 'Something went wrong. Please try again.'

const postJson = async <T>(
  path: string,
  schema: ZodType<T>,
  body: unknown = {},
): Promise<ApiResult<T>> => {
  try {
    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const payload: unknown = await response.json().catch(() => undefined)

    if (!response.ok) {
      const parsedError = ErrorResponseSchema.safeParse(payload)

      return {
        isOk: false,
        message: parsedError.success ? parsedError.data.error.message : genericMessage,
      }
    }

    const parsed = schema.safeParse(payload)

    if (!parsed.success) return { isOk: false, message: genericMessage }

    return { isOk: true, data: parsed.data }
  } catch {
    return { isOk: false, message: 'Network error. Check your connection and try again.' }
  }
}

export const startGame = () => postJson('/start-game', StartGameResponseSchema)

export const submitGuess = (gameId: string, guess: number) =>
  postJson('/guess', GuessResponseSchema, { gameId, guess })
