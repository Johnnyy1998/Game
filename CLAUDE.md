# Game

Serverless "guess the number" game. pnpm workspace with three packages:

| Package  | Contents                                                     |
| -------- | ------------------------------------------------------------ |
| `api/`   | Lambda handlers, games domain, Zod schemas, DynamoDB access  |
| `infra/` | AWS CDK app: API Gateway, Lambda, DynamoDB, S3, CloudFront   |
| `web/`   | Vite, React, Formik and Tailwind client                      |

`api/src/schema.ts` is the shared contract and the entry point of the `@game/api` package. The web
client imports the same Zod schemas the Lambdas validate against, so a contract change breaks the
client at compile time. Never duplicate a schema in `web/`; export it from `api/`.

Each package has its own `CLAUDE.md` with rules that apply only there.

## Commands

Run these from the repo root. Never commit unless asked.

```bash
pnpm verify       # lint, typecheck and every test; run this before saying you are done
pnpm lint:fix     # apply Biome fixes
pnpm build        # build web/dist, which cdk needs before it can synth
pnpm synth        # build, then synthesise the CloudFormation template
pnpm deploy:dev   # SSO login, build, then deploy the dev stage
pnpm diff         # what would change against the deployed stack
```

`pnpm synth` and the deploy scripts fail with a clear message if `web/dist` is missing, because the
stack publishes it to S3.

## AWS

Everything deploys through the `Game` SSO profile, and the account comes from those credentials, not
from a value committed here. Run `pnpm aws:login` before any `aws` CLI call; it logs in only when
the session has expired. Ask the user for account details rather than writing them into the repo.

Never write an account id, an SSO start url or a role arn into a tracked file. They belong in
`~/.aws/config` locally and in the `AWS_DEPLOY_ROLE_ARN` repository secret in CI.

## CI

`tests.yaml` runs on every push and is also callable; `deploy.yaml` is manual only and calls it as
its first job, so a deploy cannot skip the checks. Both share `.github/actions/setup`, which owns
the pnpm and Node versions; changing them in one job only is how a deploy ends up installing
something the tests never saw.

CI reaches AWS through GitHub's OIDC provider, never a stored access key. When a deploy fails with
`Not authorized to perform sts:AssumeRoleWithWebIdentity`, the cause is almost always the `sub`
claim rather than permissions: read the real shape with
`gh api repos/<owner>/<repo>/actions/oidc/customization/sub` instead of assuming the classic
`repo:<owner>/<repo>:*`, and remember that a job with `environment:` ends its claim in
`:environment:<stage>`.

## Zod

Zod is pinned to **3.23.8**. The Zod 4 API does not exist here, so watch for these:

| Wrong (Zod 4)          | Right (Zod 3.23.8)      |
| ---------------------- | ----------------------- |
| `z.uuid()`             | `z.string().uuid()`     |
| `z.literal(['a','b'])` | `z.enum(['a', 'b'])`    |
| `z.iso.datetime()`     | `z.string().datetime()` |

`z.enum` is not a TypeScript `enum`. It infers a literal union, so it satisfies the rule below; the
`enum` keyword itself is blocked by Biome.

## Schemas and types

- Name a schema `PascalCaseSchema` and declare its type directly underneath with
  `export type X = z.infer<typeof XSchema>`. Never keep types in a block at the end of the file.
- Export a schema only when another file uses it. Internal building blocks such as
  `GameStatusSchema` stay module private.
- Extract a shared building block rather than repeating a constraint. The 1..100 range lives once in
  `SecretNumberSchema`.
- Derive lookup maps from a schema and check them with `satisfies`, so adding a member fails the
  build until the map is updated:

```ts
const HTTP_STATUS_BY_ERROR_CODE = {
  badRequest: 400,
  notFound: 404,
} as const satisfies Record<ErrorCode, number>
```

- Parse anything that crosses a boundary, including items read back from DynamoDB. Never cast
  with `as`.
- A schema that has no runtime job is not a schema. If nothing calls `.parse` on it, declare a plain
  `interface` instead.

## Tooling

Biome owns formatting and linting; there is no ESLint or Prettier. Two space indent, single quotes,
no semicolons, trailing commas, 100 column lines. Do not hand format, run `pnpm lint:fix`. The rules
below are enforced by Biome where a rule exists for them, so a clean `pnpm lint` is not proof you
followed all of them.

## Syntax and formatting

- Use the `() => {...}` function definition
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements

## TypeScript usage

- Never use TypeScript enums; prefer literal unions
- Use TypeScript for all code
- Where necessary, use Zod for schema definition and then infer a type
- Avoid the `any` type, and never use a non-null assertion (`!`); both are Biome errors
- Read environment variables with bracket notation: `process.env['TABLE_NAME']`

## Code style and structure

- Write concise, technical TypeScript with accurate examples
- Use functional and declarative patterns; avoid classes
- The one exception is the error hierarchy in `api/src/core/core.errors.ts`. Errors must extend
  `Error` to survive `instanceof` after a throw, so those are classes on purpose. Do not add classes
  anywhere else.
- Prefer iteration and modularization over duplication
- Use descriptive variable names with auxiliary verbs (`isLoading`, `hasError`)

## Naming

- camelCase for folders, files, function names and variables

Three deliberate exceptions:

- **Zod schemas** are PascalCase with a `Schema` suffix: `GuessRequestSchema`
- **Module level primitive constants and constant maps** are SCREAMING_SNAKE: `MIN_SECRET`,
  `OUTCOME_MESSAGES`, `HTTP_STATUS_BY_ERROR_CODE`
- **Types and error classes** are PascalCase: `GuessResponse`, `NotFoundError`

## Tests

- Colocate a test with the file it covers: `getGame.test.ts` next to `getGame.ts`
- Test decisions this repo made, not the libraries it uses. A test that asserts Zod rejects a
  string where a number belongs is testing Zod.
- `web/` has no tests and no test runner. Do not add one without being asked.

## Comments

- Write comments only for important things, not for trivial or self-explanatory code
- Comments must always be short and clear, and explain why rather than what
