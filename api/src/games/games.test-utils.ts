import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import type { Game } from '../schema'
import type { GamesTableContext } from './games.context'

export const gameId = '3f1a9b7e-2c4d-4f6a-9b8c-5d7e1a2b3c4d'

export const activeGame: Game = {
  gameId,
  secretNumber: 42,
  status: 'active',
  attempts: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: 1_767_225_600,
}

/** Class-level mock: intercepts every document client, including the one in `ctx`. */
export const gamesTableMock = mockClient(DynamoDBDocumentClient)

export const createTestGamesContext = (): GamesTableContext => ({
  gamesTable: DynamoDBDocument.from(new DynamoDB({})),
  gamesTableName: 'games',
  gameTtlSeconds: 60,
})
