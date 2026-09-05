import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { toHaveReceivedCommandWith } from 'aws-sdk-client-mock-vitest'
import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError } from '../../core'
import { activeGame, createTestGamesContext, gameId, gamesTableMock } from '../games.test-utils'
import { getGame } from './getGame'

expect.extend({ toHaveReceivedCommandWith })

beforeEach(() => {
  gamesTableMock.reset()
})

describe('getGame', () => {
  it('throws NotFoundError when the game does not exist', async () => {
    gamesTableMock.on(GetCommand).resolves({})

    await expect(getGame({ input: { gameId }, ctx: createTestGamesContext() })).rejects.toThrow(
      NotFoundError,
    )
  })

  it('reads consistently and parses the stored item', async () => {
    gamesTableMock.on(GetCommand).resolves({ Item: activeGame })

    await expect(getGame({ input: { gameId }, ctx: createTestGamesContext() })).resolves.toEqual(
      activeGame,
    )
    expect(gamesTableMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: 'games',
      Key: { gameId },
      ConsistentRead: true,
    })
  })

  it('throws on a corrupted item instead of returning a wrong answer', async () => {
    gamesTableMock.on(GetCommand).resolves({ Item: { ...activeGame, secretNumber: 999 } })

    await expect(getGame({ input: { gameId }, ctx: createTestGamesContext() })).rejects.toThrow()
  })
})
