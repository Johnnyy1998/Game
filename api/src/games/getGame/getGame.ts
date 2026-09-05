import { NotFoundError, type Options } from '../../core'
import { type Game, GameSchema } from '../../schema'
import type { GamesTableContext } from '../games.context'

export interface GetGameInput {
  readonly gameId: string
}

export type GetGameContext = GamesTableContext

/**
 * Items read back are parsed with `GameSchema` rather than cast, so a corrupted
 * row fails loudly instead of producing a wrong answer.
 */
export const getGame = async ({
  input: { gameId },
  ctx: { gamesTable, gamesTableName },
}: Options<GetGameInput, GetGameContext>): Promise<Game> => {
  const { Item } = await gamesTable.get({
    TableName: gamesTableName,
    Key: { gameId },
    ConsistentRead: true,
  })

  if (!Item) throw new NotFoundError(`Game ${gameId} not found`)

  return GameSchema.parse(Item)
}
