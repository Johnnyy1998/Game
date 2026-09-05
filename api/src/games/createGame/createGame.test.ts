import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { toHaveReceivedCommandWith } from 'aws-sdk-client-mock-vitest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestGamesContext, gameId, gamesTableMock } from '../games.test-utils'
import { createGame } from './createGame'

expect.extend({ toHaveReceivedCommandWith })

beforeEach(() => {
  gamesTableMock.reset()
})

describe('createGame', () => {
  it('writes an active game guarded against overwriting an existing id', async () => {
    gamesTableMock.on(PutCommand).resolves({})
    const ctx = createTestGamesContext()

    const game = await createGame({ input: { gameId, secretNumber: 42 }, ctx })

    expect(game).toMatchObject({ gameId, secretNumber: 42, status: 'active', attempts: 0 })
    expect(game.expiresAt).toBe(Math.floor(Date.parse(game.createdAt) / 1000) + ctx.gameTtlSeconds)
    expect(gamesTableMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: 'games',
      Item: game,
      ConditionExpression: 'attribute_not_exists(gameId)',
    })
  })

  it('propagates a write failure', async () => {
    gamesTableMock.on(PutCommand).rejects(new Error('throttled'))

    await expect(
      createGame({ input: { gameId, secretNumber: 42 }, ctx: createTestGamesContext() }),
    ).rejects.toThrow('throttled')
  })
})
