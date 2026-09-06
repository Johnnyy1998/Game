# api

Lambda handlers and everything behind them. Entry point of the `@game/api` package is
`src/schema.ts`, so anything the web client needs must be exported from there.

## Layout

```
src/
  schema.ts          the wire contract: Zod schemas and their inferred types
  core/              transport-agnostic building blocks
    core.errors.ts   NotFoundError, ValidationError; no status codes
    core.types.ts    Options<TInput, TContext>
  http/              everything that knows about HTTP
    http.types.ts    ApiHandler
    http.utils.ts    jsonResponse, toErrorResponse, parseJsonBody
  games/             the games domain, one folder per function
    games.context.ts GamesTableContext and its factory
    getGame/getGame.ts
  handlers/          Lambda entry points, one flat file per endpoint
```

File naming inside a folder is `<folder>.<kind>.ts` (`core.errors.ts`, `http.utils.ts`,
`games.context.ts`). Domain functions get a folder of their own with `index.ts` re-exporting them.
Handlers are flat files, because they are entry points that CDK references by path, not modules.

## Layer rules

- **`schema.ts` knows nothing about anything.** Only Zod.
- **`core/` knows nothing about HTTP.** `NotFoundError` carries a message, never a status code or an
  `ErrorCode`. If `ErrorCode` ever appears in a `core/` or `games/` import, a boundary has broken.
- **`http/` is the only place that maps a thrown value to a response.** `toErrorResponse` does the
  `instanceof` branching and owns `HTTP_STATUS_BY_ERROR_CODE`. Anything unrecognised is logged and
  masked as a 500 so internals never leak.
- **`games/` is the only place that talks to DynamoDB.**
- **`handlers/` wires the endpoint together** and contains nothing else. Game rules that belong to
  one endpoint live in its handler; there is no separate rules module.

## Domain functions

Every function in `games/` takes `Options<TInput, TContext>` and returns a domain value or throws a
domain error:

```ts
export const getGame = async ({
  input: { gameId },
  ctx: { gamesTable, gamesTableName },
}: Options<GetGameInput, GetGameContext>): Promise<Game> => { ... }
```

- **Never read `process.env` or construct a client here.** The handler builds `GamesTableContext`
  once per cold start with `createGamesTableContext` and passes it down. That is what lets a test
  hand the function a mocked document client.
- **Inputs are plain interfaces, not Zod schemas.** The request body is already validated at the
  HTTP boundary; a second schema nobody parses is dead weight.
- **Report an unavailable game the same way everywhere.** A missing game, an expired game and a game
  lost to a concurrent winning guess all throw `NotFoundError`, so handlers need no branching.
- **Parse what comes back from DynamoDB** with `GameSchema`, never cast it.

## Validation

`parseJsonBody` is the only place a schema failure becomes a `ValidationError` and therefore a 400.
A `ZodError` raised anywhere else, such as missing configuration, must stay a server fault; mapping
it globally would answer 400 when the Lambda is simply misconfigured, and a test pins that down.

## Handlers

```ts
export const handler: ApiHandler = async (event) => {
  try {
    ...
  } catch (error) {
    return toErrorResponse(error)
  }
}
```

The context is built at module scope, so a missing table name fails the Lambda init loudly. Use
`ApiHandler`, not `APIGatewayProxyHandler`; the narrower type has no callback parameter and always
returns a result, which is what makes a handler directly callable from a test.

Because the context is built at import time, a handler test must set the environment before the
import:

```ts
vi.hoisted(() => {
  process.env['TABLE_NAME'] = 'games'
})

const { handler } = await import('./guess')
```

## Tests

- Colocate: `getGame.test.ts` next to `getGame.ts`
- Mock AWS with `aws-sdk-client-mock` at the `DynamoDBDocumentClient` class level; shared fixtures
  and the context factory live in `games/games.test-utils.ts`
- Assert with `toHaveReceivedCommandWith` from `aws-sdk-client-mock-vitest`; the matcher types come
  from `src/vitest.d.ts`
- Mock the Powertools logger in any test that exercises an error path, or its output floods the run
