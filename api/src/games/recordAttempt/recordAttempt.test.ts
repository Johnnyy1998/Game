import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { toHaveReceivedCommandWith } from 'aws-sdk-client-mock-vitest'
import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError } from '../../core'
import { activeGame, createTestGamesContext, gameId, gamesTableMock } from '../games.test-utils'
import { recordAttempt } from './recordAttempt'

expect.extend({ toHaveReceivedCommandWith })

beforeEach(() => {
  gamesTableMock.reset()
})

describe('recordAttempt', () => {
  it('counts the attempt only while the game is still active', async () => {
    gamesTableMock.on(UpdateCommand).resolves({ Attributes: { ...activeGame, attempts: 1 } })

    await expect(
      recordAttempt({ input: { gameId, nextStatus: 'active' }, ctx: createTestGamesContext() }),
    ).resolves.toMatchObject({ attempts: 1 })

    expect(gamesTableMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: 'games',
      Key: { gameId },
      UpdateExpression: 'SET #status = :nextStatus ADD attempts :one',
      ConditionExpression: 'attribute_exists(gameId) AND #status = :activeStatus',
      ExpressionAttributeValues: { ':nextStatus': 'active', ':activeStatus': 'active', ':one': 1 },
      ReturnValues: 'ALL_NEW',
    })
  })

  it('throws NotFoundError when the game is gone or already won', async () => {
    gamesTableMock
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'failed', $metadata: {} }))

    await expect(
      recordAttempt({ input: { gameId, nextStatus: 'won' }, ctx: createTestGamesContext() }),
    ).rejects.toThrow(NotFoundError)
  })

  it('propagates any other failure', async () => {
    gamesTableMock.on(UpdateCommand).rejects(new Error('throttled'))

    await expect(
      recordAttempt({ input: { gameId, nextStatus: 'won' }, ctx: createTestGamesContext() }),
    ).rejects.toThrow('throttled')
  })
})
