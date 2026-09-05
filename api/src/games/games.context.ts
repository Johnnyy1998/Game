import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'

export const DEFAULT_GAME_TTL_SECONDS = 86_400

export interface GamesTableContext {
  readonly gamesTable: DynamoDBDocument
  readonly gamesTableName: string
  readonly gameTtlSeconds: number
}

export const GamesTableConfigSchema = z.object({
  gamesTableName: z.string().min(1),
  // The union accepts a raw environment string as well as a number, and rejects an
  // empty string before `coerce` would quietly turn it into 0.
  gameTtlSeconds: z
    .union([z.number(), z.string().min(1)])
    .default(DEFAULT_GAME_TTL_SECONDS)
    .pipe(z.coerce.number().int().positive()),
})
/**
 * Shaped for raw environment values, so a handler can pass `process.env` entries
 * straight in and let the schema reject what is missing or empty.
 */
export interface GamesTableConfig {
  readonly gamesTableName: string | undefined
  readonly gameTtlSeconds?: string | number | undefined
}

/**
 * Built once per Lambda cold start by the handler and passed down as `ctx`.
 * Domain functions never reach for `process.env` or construct clients themselves,
 * so a test can hand them a mocked document client and any table name.
 */
export const createGamesTableContext = (config: GamesTableConfig): GamesTableContext => {
  const { gamesTableName, gameTtlSeconds } = GamesTableConfigSchema.parse(config)

  return {
    gamesTable: DynamoDBDocument.from(new DynamoDB({}), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    gamesTableName,
    gameTtlSeconds,
  }
}
