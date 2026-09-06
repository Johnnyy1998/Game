# infra

The CDK app. `pnpm synth` from the repo root builds `web/dist` first, because the stack publishes
that directory to S3.

## Layout

- **`bin/game.ts` is the application.** It decides what is specific to this deploy: the stage, the
  environment, where the built web client is. It also refuses to run when `web/dist` is missing, so
  the failure is one clear sentence instead of a broken asset later.
- **`lib/gameStack.ts` is a library.** `createGameStack(scope, id, props)` assumes nothing about the
  environment; everything arrives in `props`. That is what lets a test build the stack with its own
  `App` and a fixture directory. Never move a decision from `bin/` into it or the reverse.
- **`lib/gameStack.test.ts`** asserts over the synthesised template.
- **`lib/fixtures/webDist/`** is a two-line `index.html` so tests do not depend on a real build.

## Conventions

- **No classes.** The stack is composed from small functions taking a `Construct`, matching the rest
  of the repo.
- **Construct ids are PascalCase**: `GamesTable`, `StartGameFunction`, `SiteDistribution`. This is
  the CDK convention and the root `CLAUDE.md` camelCase rule does not apply to logical ids.
- **Never hardcode an account id.** The account comes from `CDK_DEFAULT_ACCOUNT`, which the CDK CLI
  fills from the active credentials. The region is pinned in `bin/game.ts`, because the CLI falls
  back to `us-east-1` when the profile is not the active one.
- **Take shared values from `@game/api`** rather than repeating them. `DEFAULT_GAME_TTL_SECONDS` is
  imported, not retyped.
- **Grant exact actions.** `table.grant(fn, 'dynamodb:PutItem')`, not `grantWriteData`, which also
  allows `Scan`, `Query` and `DeleteItem`. A test asserts both sets.

## Stages

The stage comes from CDK context and defaults to `dev`. The stack id carries it
(`<stage>-gameStack`), so several stages fit in one account. Anything that differs per stage goes
through a helper next to `isProd`: `tableRemovalPolicy`, `logRetention`, `logLevel`. Add a helper
rather than an inline ternary, so the whole per-stage surface stays readable in one place.

Production retains the table and the bucket and turns deletion protection on. Never make a change
that would replace the table without saying so; `RETAIN` applies to replacement too, so the old one
survives as an orphan.

## Tests

Build the stack with bundling disabled, or every run pays for esbuild:

```ts
const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } })
```

Assert behaviour that would otherwise only surface in production: which handler can read the table,
that the distribution rewrites no error responses, that a `prod` stage retains its data. Do not
assert generated logical ids or anything CDK is free to change.

`TableV2` renders tags and `DeletionProtectionEnabled` inside `Replicas[0]`, not on the table, so
assertions have to look there.

## Gotchas

- `exactOptionalPropertyTypes` is off in this package only; `aws-cdk-lib` interfaces are not
  compatible with it.
- `vitest.config.mts` needs the `.mts` extension because this package is not `"type": "module"`.
- `cloudWatchRole: true` creates the account-level `AWS::ApiGateway::Account`. In a shared account
  it overwrites whatever role is already set, so turn it off there.
- No CloudFront custom error responses. An SPA fallback rewriting 403 and 404 to `index.html` would
  also rewrite genuine API errors, turning a `404` from `/api/guess` into a `200`.
