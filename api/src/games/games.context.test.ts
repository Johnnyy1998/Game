import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_TTL_SECONDS } from '../schema'
import { createGamesTableContext } from './games.context'

describe('createGamesTableContext', () => {
  it('defaults the TTL and coerces a string from the environment', () => {
    expect(createGamesTableContext({ gamesTableName: 'games' }).gameTtlSeconds).toBe(
      DEFAULT_GAME_TTL_SECONDS,
    )
    expect(
      createGamesTableContext({ gamesTableName: 'games', gameTtlSeconds: '60' }).gameTtlSeconds,
    ).toBe(60)
  })

  it('fails when the table name is missing', () => {
    expect(() => createGamesTableContext({ gamesTableName: '' })).toThrow()
  })
})
