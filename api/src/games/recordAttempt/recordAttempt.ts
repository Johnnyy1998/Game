import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { NotFoundError, type Options } from '../../core'
import { type Game, GameSchema, type GameStatus } from '../../schema'
import type { GamesTableContext } from '../games.context'

export interface RecordAttemptInput {
  readonly gameId: string
  readonly nextStatus: GameStatus
}

export type RecordAttemptContext = GamesTableContext

/**
 * Atomically counts the attempt and closes the game on a correct guess. The
 * conditional write fails when the game is gone or already finished, so two
 * clients guessing the winning number at the same time cannot both win.
 */
export const recordAttempt = async ({
  input: { gameId, nextStatus },
  ctx: { gamesTable, gamesTableName },
}: Options<RecordAttemptInput, RecordAttemptContext>): Promise<Game> => {
  try {
    const { Attributes } = await gamesTable.update({
      TableName: gamesTableName,
      Key: { gameId },
      UpdateExpression: 'SET #status = :nextStatus ADD attempts :one',
      ConditionExpression: 'attribute_exists(gameId) AND #status = :activeStatus',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':nextStatus': nextStatus,
        ':activeStatus': 'active',
        ':one': 1,
      },
      ReturnValues: 'ALL_NEW',
    })

    if (!Attributes) throw new NotFoundError(`Game ${gameId} is no longer active`)

    return GameSchema.parse(Attributes)
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException)
      throw new NotFoundError(`Game ${gameId} is no longer active`)

    throw error
  }
}
