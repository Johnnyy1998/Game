import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gamesTableMock } from '../games/games.test-utils'
import { MAX_SECRET, MIN_SECRET, StartGameResponseSchema } from '../schema'

vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: class {
    error() {}
  },
}))

// The handler builds its context at import time, so the environment must exist first.
vi.hoisted(() => {
  process.env['TABLE_NAME'] = 'games'
  process.env['GAME_TTL_SECONDS'] = '60'
})

const { handler } = await import('./startGame')

const event = {} as APIGatewayProxyEvent

beforeEach(() => {
  gamesTableMock.reset()
})

describe('startGame handler', () => {
  it('creates a game and answers 201 with the contract shape', async () => {
    gamesTableMock.on(PutCommand).resolves({})

    const response = await handler(event)

    expect(response.statusCode).toBe(201)

    const { gameId } = StartGameResponseSchema.parse(JSON.parse(response.body))
    const item = gamesTableMock.commandCalls(PutCommand)[0]?.args[0].input.Item

    expect(item?.['gameId']).toBe(gameId)
    expect(item?.['secretNumber']).toBeGreaterThanOrEqual(MIN_SECRET)
    expect(item?.['secretNumber']).toBeLessThanOrEqual(MAX_SECRET)
  })

  it('masks a write failure as 500', async () => {
    gamesTableMock.on(PutCommand).rejects(new Error('throttled'))

    const response = await handler(event)

    expect(response.statusCode).toBe(500)
  })
})
