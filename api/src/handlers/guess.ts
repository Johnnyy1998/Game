import { createGamesTableContext, getGame, recordAttempt } from '../games'
import { type ApiHandler, jsonResponse, parseJsonBody, toErrorResponse } from '../http'
import { type GuessOutcome, GuessRequestSchema, type GuessResponse } from '../schema'

const OUTCOME_MESSAGES = {
  tooLow: 'Too low. Try again!',
  tooHigh: 'Too high. Try again!',
  correct: "Correct! You've guessed the number.",
} as const satisfies Record<GuessOutcome, string>

const evaluateGuess = (guess: number, secretNumber: number): GuessOutcome => {
  if (guess < secretNumber) return 'tooLow'
  if (guess > secretNumber) return 'tooHigh'
  return 'correct'
}

// Built once per cold start; a missing table name fails the Lambda init loudly.
const ctx = createGamesTableContext({
  gamesTableName: process.env['TABLE_NAME'],
  gameTtlSeconds: process.env['GAME_TTL_SECONDS'],
})

export const handler: ApiHandler = async (event) => {
  try {
    const { gameId, guess } = parseJsonBody(event.body, GuessRequestSchema)
    const game = await getGame({ input: { gameId }, ctx })
    const outcome = evaluateGuess(guess, game.secretNumber)

    // A finished game, including one lost to a concurrent winning guess, fails the
    // conditional write and surfaces as a 404.
    const { attempts } = await recordAttempt({
      input: { gameId, nextStatus: outcome === 'correct' ? 'won' : 'active' },
      ctx,
    })

    return jsonResponse(200, {
      message: OUTCOME_MESSAGES[outcome],
      outcome,
      attempts,
    } satisfies GuessResponse)
  } catch (error) {
    return toErrorResponse(error)
  }
}
