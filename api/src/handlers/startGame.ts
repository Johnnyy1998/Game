import { randomUUID } from 'node:crypto'
import { createGame, createGamesTableContext } from '../games'
import { type ApiHandler, jsonResponse, toErrorResponse } from '../http'
import { MAX_SECRET, MIN_SECRET, type StartGameResponse } from '../schema'

const START_GAME_MESSAGE = `Game started. Make a guess between ${MIN_SECRET} and ${MAX_SECRET}.`

// Inclusive range, uniform enough for a game; see README for the crypto alternative.
const randomSecretNumber = (): number =>
  Math.floor(Math.random() * (MAX_SECRET - MIN_SECRET + 1)) + MIN_SECRET

// Built once per cold start; a missing table name fails the Lambda init loudly.
const ctx = createGamesTableContext({
  gamesTableName: process.env['TABLE_NAME'],
  gameTtlSeconds: process.env['GAME_TTL_SECONDS'],
})

export const handler: ApiHandler = async () => {
  try {
    const gameId = randomUUID()

    await createGame({ input: { gameId, secretNumber: randomSecretNumber() }, ctx })

    return jsonResponse(201, {
      gameId,
      message: START_GAME_MESSAGE,
    } satisfies StartGameResponse)
  } catch (error) {
    return toErrorResponse(error)
  }
}
