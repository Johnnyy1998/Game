# Game

Serverless "guess the number" game on AWS. The API runs on API Gateway, Lambda and DynamoDB, the web
client is a Vite app served from S3 through CloudFront, and everything is defined in AWS CDK
(TypeScript). Serving the API under the same CloudFront domain removes CORS from the browser
entirely and keeps one hostname for the whole app.

## Repository layout

| Path   | Contents                                                        |
| ------ | --------------------------------------------------------------- |
| `api/` | Zod schemas, core errors, HTTP mapping and the games domain      |
| `infra/` | CDK app and stack, plus assertions tests over the template     |
| `web/` | Vite, React and Tailwind client                                 |

## Prerequisites

- Node.js 22 (`.nvmrc` is provided)
- pnpm 10
- AWS credentials for the target account, and `cdk bootstrap` run once per account and region

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
pnpm synth     # build, then synthesise the CloudFormation template
pnpm deploy    # build, then deploy the stack
pnpm destroy   # tear the stack down
```

## Local development

The Lambdas are not emulated. Deploy once, then point the Vite dev proxy at the deployed stage:

```bash
cp web/.env.example web/.env.local   # set VITE_API_PROXY_TARGET to the apiUrl host
pnpm dev
```

The dev server proxies `/api/*` to API Gateway, so the client code path is identical in dev and in
production.

## Stages

The stage defaults to `dev` and comes from CDK context, so several stages fit in one account:

```bash
pnpm --filter @game/infra exec cdk deploy -c stage=prod
```

| | `dev` and other stages | `prod` |
| --- | --- | --- |
| Stack id | `<stage>-gameStack` | `prod-gameStack` |
| Table and bucket | `DESTROY`, objects auto deleted | `RETAIN`, deletion protection on |
| Log retention | 1 week | 3 months |
| `POWERTOOLS_LOG_LEVEL` | `INFO` (`WARN` on `staging`) | `WARN` |

Every resource is tagged `project=game` and `stage=<stage>`.

`pnpm synth` and `pnpm deploy` build `web/dist` first and fail with a clear message if it is
missing, because the stack publishes it to S3. Deploying prints three outputs: `siteUrl` (open this
to play), `apiUrl` (the direct API Gateway stage) and `tableName`.

`api/src/schema.ts` is the shared contract and the entry point of the `@game/api` package. The web
client imports the same Zod schemas the API validates against, so a change to the API shape breaks
the client at compile time.

## API

### `POST /start-game`

No request body. Responds `201`:

```json
{
  "gameId": "3f1a9b7e-2c4d-4f6a-9b8c-5d7e1a2b3c4d",
  "message": "Game started. Make a guess between 1 and 100."
}
```

### `POST /guess`

```json
{ "gameId": "3f1a9b7e-2c4d-4f6a-9b8c-5d7e1a2b3c4d", "guess": 42 }
```

Responds `200`:

```json
{ "message": "Too low. Try again!", "outcome": "tooLow", "attempts": 4 }
```

`outcome` is one of `tooLow`, `tooHigh`, `correct`. A guess against a game that no longer exists or
is already finished answers `404`.

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
