# Game

Serverless "guess the number" game. A pnpm workspace holding the Vite web client, the API contract,
and later the handlers and AWS CDK infrastructure that run it.

## Repository layout

| Path   | Contents                                                        |
| ------ | --------------------------------------------------------------- |
| `api/` | Zod schemas, core errors, HTTP mapping and the games domain      |
| `web/` | Vite, React and Tailwind client                                 |

## Prerequisites

- Node.js 22 (`.nvmrc` is provided)
- pnpm 10

## Commands

```bash
pnpm install   # install every workspace package
pnpm dev       # run the web client locally
pnpm build     # build the web client into web/dist
pnpm lint      # Biome format and lint check
pnpm lint:fix  # apply Biome fixes
pnpm typecheck # TypeScript across the workspace
pnpm test      # unit tests
pnpm verify    # lint, typecheck and every test
```

`api/src/schema.ts` is the shared contract and the entry point of the `@game/api` package. The web
client imports the same Zod schemas the API validates against, so a change to the API shape breaks
the client at compile time.

## Error responses

All errors share one shape, and `code` is a closed set: `badRequest`, `notFound` or
`internalError`. `details` is present only for validation failures and lists the offending fields.

```json
{
  "error": {
    "code": "badRequest",
    "message": "Request body is invalid.",
    "details": [{ "field": "guess", "message": "Expected number, received string" }]
  }
}
```

Domain code throws transport-agnostic errors from `api/src/core/core.errors.ts` (`NotFoundError`,
`ValidationError`) and knows nothing about HTTP. `toErrorResponse` in `api/src/http/http.utils.ts`
is the single place that maps a thrown value to a response and masks anything unexpected as a 500.
`HTTP_STATUS_BY_ERROR_CODE` is checked with `satisfies Record<ErrorCode, number>`, so a new code
fails the build until its status is added.

## Data model

One DynamoDB table, `gameId` as the partition key and no secondary indexes.

| Attribute      | Type   | Notes                                             |
| -------------- | ------ | ------------------------------------------------- |
| `gameId`       | string | UUID v4, partition key                            |
| `secretNumber` | number | 1..100, never returned to the client              |
| `status`       | string | `active` or `won`                                 |
| `attempts`     | number | Incremented atomically on every accepted guess    |
| `createdAt`    | string | ISO timestamp                                     |
| `expiresAt`    | number | Epoch seconds, TTL attribute, 24 hours by default |

`api/src/games/` is the only place that talks to DynamoDB. It follows a context pattern: the
handler builds a `GamesTableContext` once per cold start with `createGamesTableContext` and passes
it as `ctx`, so domain functions never read `process.env` or construct clients and a test can hand
them a mocked document client. Every function lives in its own folder, takes
`Options<Input, Context>` and exports a Zod input schema next to it.

- `getGame` throws `NotFoundError` for an unknown id and parses the item with `GameSchema` rather
  than casting, so a corrupted row fails loudly instead of producing a wrong answer.
- `recordAttempt` applies the attempt with a conditional `UpdateItem`
  (`attribute_exists(gameId) AND status = 'active'`) and returns `undefined` when the game is gone
  or already finished, so two clients guessing the winning number at the same time cannot both win.
