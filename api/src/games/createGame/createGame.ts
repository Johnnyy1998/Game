import type { Options } from '../../core'
import type { Game } from '../../schema'
import type { GamesTableContext } from '../games.context'

export interface CreateGameInput {
  readonly gameId: string
  readonly secretNumber: number
}

export type CreateGameContext = GamesTableContext

export const createGame = async ({
  input: { gameId, secretNumber },
  ctx: { gamesTable, gamesTableName, gameTtlSeconds },
}: Options<CreateGameInput, CreateGameContext>): Promise<Game> => {
  const now = new Date()

  const game: Game = {
    gameId,
    secretNumber,
    status: 'active',
    attempts: 0,
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + gameTtlSeconds,
  }

  await gamesTable.put({
    TableName: gamesTableName,
    Item: game,
    ConditionExpression: 'attribute_not_exists(gameId)',
  })

  return game
}
