import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeGame, gameId, gamesTableMock } from '../games/games.test-utils'
import { ErrorResponseSchema, GuessResponseSchema } from '../schema'

// The handler builds its context at import time, so the environment must exist first.
vi.hoisted(() => {
  process.env['TABLE_NAME'] = 'games'
  process.env['GAME_TTL_SECONDS'] = '60'
})

const { handler } = await import('./guess')

const eventWith = (body: string | null): APIGatewayProxyEvent =>
  ({ body }) as unknown as APIGatewayProxyEvent

const guessEvent = (guess: unknown) => eventWith(JSON.stringify({ gameId, guess }))

beforeEach(() => {
  gamesTableMock.reset()
  gamesTableMock.on(GetCommand).resolves({ Item: activeGame })
})

describe('guess handler', () => {
  it('answers 200 with the message required by the contract', async () => {
    gamesTableMock.on(UpdateCommand).resolves({ Attributes: { ...activeGame, attempts: 1 } })

    const response = await handler(guessEvent(10))

    expect(response.statusCode).toBe(200)
    expect(GuessResponseSchema.parse(JSON.parse(response.body))).toEqual({
      message: 'Too low. Try again!',
      outcome: 'tooLow',
      attempts: 1,
    })
  })

  it('closes the game on a correct guess', async () => {
    gamesTableMock
      .on(UpdateCommand)
      .resolves({ Attributes: { ...activeGame, status: 'won', attempts: 3 } })

    const response = await handler(guessEvent(activeGame.secretNumber))

    expect(JSON.parse(response.body)).toMatchObject({
      outcome: 'correct',
      message: "Correct! You've guessed the number.",
    })
    expect(
      gamesTableMock.commandCalls(UpdateCommand)[0]?.args[0].input.ExpressionAttributeValues,
    ).toMatchObject({ ':nextStatus': 'won' })
  })

  it('answers 400 with field errors for a guess outside the range', async () => {
    const response = await handler(guessEvent(0))

    expect(response.statusCode).toBe(400)
    expect(ErrorResponseSchema.parse(JSON.parse(response.body)).error).toMatchObject({
      code: 'badRequest',
      details: [{ field: 'guess' }],
    })
  })

  it('answers 400 for a missing body', async () => {
    expect((await handler(eventWith(null))).statusCode).toBe(400)
  })

  it('answers 404 when the game does not exist', async () => {
    gamesTableMock.on(GetCommand).resolves({})

    const response = await handler(guessEvent(10))

    expect(response.statusCode).toBe(404)
    expect(ErrorResponseSchema.parse(JSON.parse(response.body)).error.code).toBe('notFound')
  })

  it('answers 404 when a concurrent guess already won the game', async () => {
    gamesTableMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'failed', $metadata: {} }))

    expect((await handler(guessEvent(10))).statusCode).toBe(404)
  })
})
