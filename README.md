# Game

Serverless "guess the number" game on AWS. The API runs on API Gateway, Lambda and DynamoDB, the web
client is a Vite app served from S3 through CloudFront, and everything is defined in AWS CDK
(TypeScript). Serving the API under the same CloudFront domain removes CORS from the browser
entirely and keeps one hostname for the whole app.

## Repository layout

| Path     | Contents                                                      |
| -------- | ------------------------------------------------------------- |
| `api/`   | Lambda handlers plus the `games`, `http` and `core` modules    |
| `infra/` | CDK app and stack, plus assertions tests over the template     |
| `web/`   | Vite, React, Formik and Tailwind client                        |

`api/src/schema.ts` is the shared contract and the entry point of the `@game/api` package. The web
client imports the same Zod schemas the API validates against, so a change to the API shape breaks
the client at compile time.

## Prerequisites

- Node.js 22 (`.nvmrc` is provided)
- pnpm 10
- The `Game` SSO profile in `~/.aws/config`, and `cdk bootstrap` run once for that account and
  region

## Commands

```bash
pnpm install      # install every workspace package
pnpm dev          # run the web client locally
pnpm build        # build the web client into web/dist
pnpm lint         # Biome format and lint check
pnpm lint:fix     # apply Biome fixes
pnpm typecheck    # TypeScript across the workspace
pnpm test         # unit tests
pnpm verify       # lint, typecheck and every test
pnpm aws:login    # SSO login, only when the session has expired
pnpm synth        # build, then synthesise the CloudFormation template
pnpm diff         # what would change against the deployed stack
pnpm deploy:dev   # SSO login, build, then deploy the dev stage
pnpm deploy:prod  # the same for the prod stage
pnpm destroy:dev  # tear the dev stage down
```

Everything that reaches AWS runs `aws:login` first and passes `--profile Game`. The deploy scripts
build `web/dist` before synthesising, and the stack fails with a clear message if it is missing,
because it publishes that directory to S3. A deploy prints three outputs: `siteUrl` (open this to
play), `apiUrl` (the direct API Gateway stage) and `tableName`.

## CI

`.github/workflows/tests.yaml` runs on every push: lint, typecheck, unit tests, then `pnpm synth`.
The synth step needs no credentials and catches what the unit tests cannot, that the stack still
renders and both handlers still bundle.

`.github/workflows/deploy.yaml` is manual only, through **Actions → Deploy → Run workflow**, where
the stage is chosen. Its first job calls `tests.yaml`, so a deploy cannot skip the checks that guard
a push, and the deploy job runs in a GitHub environment named after the stage. Add required
reviewers to the `prod` environment to gate production behind an approval.

Deploying authenticates with short lived credentials from GitHub's OIDC provider rather than a
stored access key. It needs an IAM identity provider for `token.actions.githubusercontent.com`, a
role trusting it for this repository whose only permission is `sts:AssumeRole` on the
`cdk-hnb659fds-*` roles that `cdk bootstrap` created, and a repository secret
`AWS_DEPLOY_ROLE_ARN` holding that role's arn.

## Local development

The Lambdas are not emulated. Deploy once, then point the Vite dev proxy at the deployed stage:

```bash
cp web/.env.example web/.env.local   # set VITE_API_PROXY_TARGET to the apiUrl host
pnpm dev
```

The dev server proxies `/api/*` to API Gateway, so the client code path is identical in dev and in
production.

## Stages

The stage comes from CDK context and defaults to `dev`. The stack id carries it
(`<stage>-gameStack`), so several stages live side by side in one account, each with its own table,
bucket and distribution.

| | `dev` and other stages | `prod` |
| --- | --- | --- |
| Table and bucket | `DESTROY`, objects auto deleted | `RETAIN`, deletion protection on |
| Log retention | 1 week | 3 months |
| `POWERTOOLS_LOG_LEVEL` | `INFO` (`WARN` on `staging`) | `WARN` |

Every resource is tagged `project=game` and `stage=<stage>`.

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
| `expiresAt`    | number | Epoch seconds, TTL attribute, 10 minutes by default |

`api/src/games/` is the only place that talks to DynamoDB. It follows a context pattern: the
handler builds a `GamesTableContext` once per cold start with `createGamesTableContext` and passes
it as `ctx`, so domain functions never read `process.env` or construct clients and a test can hand
them a mocked document client. Every function lives in its own folder and takes
`Options<Input, Context>`.

- `getGame` throws `NotFoundError` for an unknown id and parses the item with `GameSchema` rather
  than casting, so a corrupted row fails loudly instead of producing a wrong answer.
- DynamoDB removes expired items hours after `expiresAt`, so `getGame` also compares the deadline
  on every read and answers `404` for a game that has run out. The TTL attribute only keeps the
  table small.
- `recordAttempt` applies the attempt with a conditional `UpdateItem`
  (`attribute_exists(gameId) AND status = 'active'`) and throws `NotFoundError` when the game is
  gone or already finished, so two clients guessing the winning number at the same time cannot both
  win.

## Design decisions

- **Zod is the single source of truth.** Requests, stored items and responses all have schemas in
  `api/src/schema.ts`, and every TypeScript type is inferred from them. That file is also the entry
  point of the `@game/api` package, so the web client imports the very schemas the Lambdas validate
  against and a contract change breaks the client at compile time. Nothing is cast with `as`.
- **Every value set is a literal union, never a TypeScript enum.** Game status, guess outcome and
  error code are declared once as `z.enum([...])`. Zod is pinned to 3.23.8 to match the sibling
  repo, so the Zod 4 API is unavailable.
- **Domain errors know nothing about HTTP.** `core/core.errors.ts` holds `NotFoundError` and
  `ValidationError` without status codes; `http/http.utils.ts` is the only module that maps them to
  a code and a status. The same domain functions would work behind a queue consumer or tRPC.
- **Handlers contain no error branching.** A missing game, an expired game and a game lost to a
  concurrent winning guess all surface as `NotFoundError`, so the handler is a straight line:
  parse, load, evaluate, record, respond.
- **Only the body parser turns a schema failure into a 400.** A `ZodError` from anywhere else, such
  as missing configuration, stays a server fault. Answering 400 because the Lambda is misconfigured
  would blame the client for an operator mistake.
- **Context injection instead of module singletons.** The handler builds the DynamoDB client once
  per cold start and passes it down, so no domain function reaches for `process.env` and tests need
  no module mocking.
- **Expiry is enforced twice, on purpose.** The table TTL reclaims rows for free but deletes hours
  late, so `getGame` also checks the deadline. The TTL keeps the table small; the check keeps the
  behaviour honest.
- **No classes except errors.** Errors must extend `Error` to survive `instanceof` after a throw.
  Everything else, the CDK stack included, is composed from functions.
- **The AWS SDK is bundled** (`externalModules: []`), so the deployed version is pinned by the lock
  file rather than inherited from whatever the Lambda runtime ships that week. It costs about
  600 kB per bundle.
- **ESM output, arm64, 512 MB.** Graviton is cheaper per millisecond, and source maps are enabled
  with `NODE_OPTIONS=--enable-source-maps` so minified stack traces stay readable.
- **No CloudFront custom error responses.** An SPA fallback that rewrites 403 and 404 to
  `index.html` would also rewrite genuine API errors, turning a `404` from `/api/guess` into a
  `200`. The app is a single route, so the fallback is unnecessary, and a test pins that down.
- **`Math.random` for the secret number.** It is not cryptographically strong, which is fine for a
  game. `crypto.randomInt` is the drop-in replacement if the number ever becomes worth protecting.
- **Each handler gets only the table actions it calls.** `grantWriteData` and `grantReadWriteData`
  would also allow `Scan`, `Query` and `DeleteItem`, so the grants are spelled out:
  `dynamodb:PutItem` for start-game, `dynamodb:GetItem` and `dynamodb:UpdateItem` for guess. A test
  asserts both sets and that neither handler can scan or delete.
- **Infrastructure is tested.** `infra/lib/gameStack.test.ts` asserts over the synthesised template:
  that the start-game handler cannot read the table, that the distribution rewrites no errors, and
  that a `prod` stage retains the table with deletion protection.

## Production ideas

**Security**

- Both endpoints are public and unauthenticated. Put Cognito, a Lambda authorizer or at minimum API
  Gateway API keys with usage plans in front of them.
- Add AWS WAF to the distribution with rate-based rules. Without it a script can create unbounded
  games and drive DynamoDB write cost.
- The guess endpoint is brute forceable by design; 100 requests always win. Cap attempts per game
  if that matters.

**Observability**

- Alarm on Lambda errors and throttles, API Gateway `5XXError` and latency, and DynamoDB
  `ThrottledRequests`. Route them to SNS.
- Put the API Gateway request id on every log line, so one request is one query in CloudWatch.
